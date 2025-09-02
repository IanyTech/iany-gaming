// Helper globale per ottenere il client Supabase in modo robusto
function getSupaClient() {
  try {
    if (typeof window.supaReady === 'function' && window.supaReady()) {
      const c = typeof window.supa === 'function' ? window.supa() : null;
      if (c && typeof c.auth?.getUser === 'function') return c;
    }
  } catch(_) {}
  try {
    if (window.supabaseClient && typeof window.supabaseClient.auth?.getUser === 'function') {
      return window.supabaseClient;
    }
  } catch(_) {}
  try {
    if (window.SUPA && typeof window.SUPA.auth?.getUser === 'function') {
      return window.SUPA;
    }
  } catch(_) {}
  return null;
}

class LoyaltyProfile {
  constructor() {
    this.user = null;
    this.loyaltyData = null;
    this.transactions = [];
    this.supa = null;
    
    // Loyalty tiers configuration
    this.tiers = {
      bronze: { minPoints: 0, name: 'Bronzo', icon: '🥉', nextTier: 'silver', nextTierPoints: 500 },
      silver: { minPoints: 500, name: 'Argento', icon: '🥈', nextTier: 'gold', nextTierPoints: 1500 },
      gold: { minPoints: 1500, name: 'Oro', icon: '🥇', nextTier: 'platinum', nextTierPoints: 3500 },
      platinum: { minPoints: 3500, name: 'Platino', icon: '💎', nextTier: null, nextTierPoints: 0 }
    };
    
    this.init();
  }

  // (Funzionalità link d'invito rimossa su richiesta)
  
  async init() {
    // Wait for auth to be ready
    const checkAuth = setInterval(() => {
      const client = getSupaClient();
      if (client) {
        clearInterval(checkAuth);
        this.supa = client;
        this.setupEventListeners();
        this.checkAuthState();
        // Ascolta i cambi di autenticazione per aggiornare i dati
        try {
          this.supa.auth.onAuthStateChange(async () => {
            await this.checkAuthState();
          });
        } catch(_) {}
      }
    }, 100);
  }
  
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = e.currentTarget.dataset.tab;
        this.switchTab(tabId);
      });
    });
    
    // Redeem buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.redeem-btn')) {
        const button = e.target.closest('.redeem-btn');
        const rewardType = button.dataset.reward;
        const points = parseInt(button.dataset.points, 10);
        this.handleRedeem(rewardType, points);
      }
    });
    
    // View all transactions
    const viewAllBtn = document.getElementById('viewAllTransactions');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => this.loadTransactions(true));
    }

    // Listener invito rimossi
  }
  
  async checkAuthState() {
    this.supa = this.supa || getSupaClient();
    if (!this.supa) return;
    let user = null;
    try {
      const { data: s } = await this.supa.auth.getSession();
      user = s?.session?.user || null;
      if (!user) {
        const res = await this.supa.auth.getUser();
        user = res?.data?.user || null;
      }
    } catch(_) {}
    if (user) {
      this.user = user;
      await this.loadLoyaltyData();
      await this.loadTransactions();
    } else {
      this.user = null;
    }
    this.updateUI();
  }
  
  async loadLoyaltyData() {
    if (!this.user) return;
    this.supa = this.supa || getSupaClient();
    if (!this.supa) return;
    
    try {
      const { data, error } = await this.supa
        .from('loyalty_points')
        .select('*')
        .eq('user_id', this.user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading loyalty data:', error);
        return;
      }
      
      this.loyaltyData = data || { points: 0, tier: 'bronze' };
      this.updateUI();
      
    } catch (error) {
      console.error('Error in loadLoyaltyData:', error);
    }
  }
  
  async loadTransactions(showAll = false) {
    if (!this.user) return;
    this.supa = this.supa || getSupaClient();
    if (!this.supa) return;
    
    try {
      let query = this.supa
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', this.user.id)
        .order('created_at', { ascending: false });
      
      if (!showAll) {
        query = query.limit(5);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading transactions:', error);
        return;
      }
      
      this.transactions = data || [];
      this.updateTransactionsUI();
      
    } catch (error) {
      console.error('Error in loadTransactions:', error);
    }
  }
  
  getCurrentTier() {
    if (!this.loyaltyData) return this.tiers.bronze;
    return this.tiers[this.loyaltyData.tier] || this.tiers.bronze;
  }
  
  getNextTier() {
    const currentTier = this.getCurrentTier();
    if (!currentTier.nextTier) return null;
    return this.tiers[currentTier.nextTier];
  }
  
  calculateProgress() {
    const currentTier = this.getCurrentTier();
    const nextTier = this.getNextTier();
    
    if (!nextTier) {
      return {
        progress: 100,
        pointsToNext: 0,
        nextTierName: null
      };
    }
    
    const pointsInCurrentTier = (this.loyaltyData?.points || 0) - currentTier.minPoints;
    const pointsNeeded = nextTier.minPoints - currentTier.minPoints;
    const progress = Math.min(100, Math.round((pointsInCurrentTier / pointsNeeded) * 100));
    
    return {
      progress,
      pointsToNext: nextTier.minPoints - (this.loyaltyData?.points || 0),
      nextTierName: nextTier.name
    };
  }
  
  updateUI() {
    if (!this.loyaltyData) return;
    
    const currentTier = this.getCurrentTier();
    const progress = this.calculateProgress();
    
    // Update tier badge
    const badgeEl = document.getElementById('loyaltyTierBadge');
    if (badgeEl) {
      badgeEl.innerHTML = `
        <div class="tier-icon">${currentTier.icon}</div>
        <div class="tier-info">
          <div class="tier-name">Livello ${currentTier.name}</div>
          <div class="points-balance">${this.loyaltyData.points || 0} punti</div>
        </div>
      `;
    }
    
    // Update progress bar
    const progressBar = document.getElementById('loyaltyProgressBar');
    if (progressBar) {
      progressBar.style.width = `${progress.progress}%`;
    }
    
    // Update progress text
    const nextTierPoints = document.getElementById('nextTierPoints');
    if (nextTierPoints) {
      const currentPoints = this.loyaltyData.points || 0;
      const nextTier = this.getNextTier();
      
      if (nextTier) {
        nextTierPoints.textContent = `${currentPoints}/${nextTier.minPoints}`;
      } else {
        nextTierPoints.textContent = 'Livello massimo raggiunto';
      }
    }
    
    // Update progress hint
    const nextTierHint = document.getElementById('nextTierHint');
    if (nextTierHint) {
      if (progress.nextTierName) {
        nextTierHint.textContent = `Mancano ${progress.pointsToNext} punti per il livello ${progress.nextTierName}`;
      } else {
        nextTierHint.textContent = 'Hai raggiunto il livello massimo!';
      }
    }
    
    // Update redeem buttons state
    this.updateRedeemButtons();
  }
  
  updateTransactionsUI() {
    const container = document.getElementById('loyaltyTransactionsList');
    if (!container) return;
    
    if (!this.transactions || this.transactions.length === 0) {
      container.innerHTML = '<div class="no-transactions">Nessuna transazione recente</div>';
      return;
    }
    
    container.innerHTML = this.transactions.map(transaction => {
      const date = new Date(transaction.created_at).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      const isPositive = transaction.points > 0;
      const pointsClass = isPositive ? 'positive' : 'negative';
      const pointsPrefix = isPositive ? '+' : '';
      
      return `
        <div class="transaction-item">
          <div class="transaction-details">
            <div class="transaction-description">${transaction.description}</div>
            <div class="transaction-date">${date}</div>
          </div>
          <div class="transaction-amount ${pointsClass}">
            ${pointsPrefix}${transaction.points} punti
          </div>
        </div>
      `;
    }).join('');
  }
  
  updateRedeemButtons() {
    const points = this.loyaltyData?.points || 0;
    
    document.querySelectorAll('.redeem-btn').forEach(button => {
      const requiredPoints = parseInt(button.dataset.points, 10);
      button.disabled = points < requiredPoints;
      
      if (button.disabled) {
        button.title = `Ti servono altri ${requiredPoints - points} punti per sbloccare questo premio`;
      } else {
        button.title = '';
      }
    });
  }
  
  async handleRedeem(rewardType, points) {
    if (!this.user) {
      console.error('User not authenticated');
      return;
    }
    
    if ((this.loyaltyData?.points || 0) < points) {
      console.error('Not enough points');
      return;
    }
    
    try {
      this.supa = this.supa || getSupaClient();
      if (!this.supa) return;
      // Create a transaction record
      const { data: transaction, error } = await this.supa
        .from('loyalty_transactions')
        .insert([{
          user_id: this.user.id,
          points: -points,
          description: this.getRewardDescription(rewardType),
          type: 'redemption'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Update points balance
      const { error: updateError } = await this.supa.rpc('update_loyalty_points', {
        user_id: this.user.id,
        points_change: -points
      });
      
      if (updateError) throw updateError;
      
      // Reload data
      await this.loadLoyaltyData();
      await this.loadTransactions();
      
      // Show success message
      this.showSuccess('Premio riscattato con successo!');
      
    } catch (error) {
      console.error('Error redeeming reward:', error);
      this.showError('Si è verificato un errore durante il riscatto del premio.');
    }
  }
  
  getRewardDescription(rewardType) {
    const rewards = {
      '10_off': 'Sconto del 10%',
      '15_off': 'Sconto del 15%',
      '20_off': 'Sconto del 20%'
    };
    
    return rewards[rewardType] || 'Premio sconto';
  }
  
  switchTab(tabId) {
    // Hide all panels
    document.querySelectorAll('.panel').forEach(panel => {
      panel.hidden = true;
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Show selected panel and activate tab
    const panel = document.getElementById(`accPanel${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    const tab = document.querySelector(`.account-tab[data-tab="${tabId}"]`);
    
    if (panel) panel.hidden = false;
    if (tab) tab.classList.add('active');
  }
  
  showSuccess(message) {
    // You can implement a toast notification here
    alert(message);
  }
  
  showError(message) {
    // You can implement a toast notification here
    alert(`Errore: ${message}`);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.loyaltyProfile = new LoyaltyProfile();
});
