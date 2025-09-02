// Resolve Supabase client safely (prefers global SUPA, then fallbacks)
function getSupaClient() {
  try {
    if (typeof SUPA !== 'undefined' && SUPA) return SUPA;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.supabase) return window.supabase;
  } catch (_) {}
  return null;
}

// Funzione per controllare e assegnare i punti compleanno
async function checkAndAwardBirthdayPoints(userId) {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    const client = getSupaClient();
    if (!client) return;

    // Ottieni il profilo utente con la data di nascita
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('birthdate, last_birthday_points_year')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.birthdate) return;

    const birthDate = new Date(profile.birthdate);
    const birthMonth = birthDate.getMonth() + 1;
    const birthDay = birthDate.getDate();

    // Controlla se oggi è il compleanno e se non ha già ricevuto i punti quest'anno
    if (birthMonth === currentMonth && birthDay === currentDay && 
        profile.last_birthday_points_year !== currentYear) {
      
      // Assegna i punti compleanno
      const { error: pointsError } = await client.rpc('add_loyalty_points', {
        p_user_id: userId,
        p_points: 50,
        p_reason: 'Auguri di Buon Compleanno!',
        p_reference_id: null
      });

      if (!pointsError) {
        // Aggiorna l'anno dell'ultimo premio compleanno
        await client
          .from('profiles')
          .update({ last_birthday_points_year: currentYear })
          .eq('id', userId);
        
        // Mostra notifica all'utente
        showToast('Hai ricevuto 50 punti fedeltà per il tuo compleanno! 🎉', 'success');
      }
    }
  } catch (error) {
    console.error('Errore nel controllo del compleanno:', error);
  }
}

class LoyaltySystem {
  constructor(userId) {
    this.userId = userId;
    this.pointsBalance = 0;
    this.tier = 'bronze';
    this.tiers = {
      bronze: { minPoints: 0, name: 'Bronzo', discount: 0.05 },
      silver: { minPoints: 500, name: 'Argento', discount: 0.07 },
      gold: { minPoints: 2000, name: 'Oro', discount: 0.1 },
      platinum: { minPoints: 5000, name: 'Platino', discount: 0.15 }
    };
    this.transactions = [];
  }

  async init() {
    try {
      const client = getSupaClient();
      if (!client) return false;
      // Controlla e assegna i punti compleanno all'avvio
      if (this.userId) {
        await checkAndAwardBirthdayPoints(this.userId);
      }
      // Load user's loyalty data
      const { data: loyaltyData, error: loyaltyError } = await client
        .from('loyalty_points')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (loyaltyError && loyaltyError.code !== 'PGRST116') {
        console.error('Error loading loyalty data:', loyaltyError);
        return false;
      }

      if (loyaltyData) {
        this.pointsBalance = loyaltyData.points_balance;
        this.tier = loyaltyData.tier;
        
        // Update UI with loaded data
        this.updateUIBalance();
        this.updateUITier();
      } else {
        // Initialize new loyalty account
        const { error } = await client
          .from('loyalty_points')
          .insert([
            { 
              user_id: this.userId, 
              points_balance: 0, 
              tier: 'bronze',
              total_earned: 0,
              total_redeemed: 0
            }
          ]);

        if (error) {
          console.error('Error initializing loyalty account:', error);
          return false;
        }
      }

      // Load recent transactions
      await this.loadTransactions();
      return true;
      
    } catch (error) {
      console.error('Error initializing loyalty system:', error);
      return false;
    }
  }

  async loadTransactions(limit = 5) {
    try {
      const client = getSupaClient();
      if (!client) return [];
      const { data, error } = await client
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      this.transactions = data || [];
      this.updateUITransactions();
      return this.transactions;
      
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }

  async addPoints(points, reason = 'Punti aggiunti', referenceId = null) {
    try {
      const client = getSupaClient();
      if (!client) return { success: false, error: 'Supabase non inizializzato' };
      const { data, error } = await client.rpc('add_loyalty_points', {
        p_user_id: this.userId,
        p_points: points,
        p_reason: reason,
        p_reference_id: referenceId
      });

      if (error) throw error;

      this.pointsBalance = data.new_balance;
      this.tier = data.new_tier;
      
      this.updateUIBalance();
      this.updateUITier();
      await this.loadTransactions();
      
      return { 
        success: true, 
        newBalance: this.pointsBalance, 
        newTier: this.tier 
      };
      
    } catch (error) {
      console.error('Error adding points:', error);
      return { success: false, error: error.message };
    }
  }

  async redeemPoints(points, reason = 'Riscatto punti', referenceId = null) {
    try {
      const client = getSupaClient();
      if (!client) return { success: false, error: 'Supabase non inizializzato' };
      const { data, error } = await client.rpc('redeem_loyalty_points', {
        p_user_id: this.userId,
        p_points: points,
        p_reason: reason,
        p_reference_id: referenceId
      });

      if (error) throw error;

      this.pointsBalance = data.new_balance;
      
      this.updateUIBalance();
      await this.loadTransactions();
      
      return { 
        success: true, 
        newBalance: this.pointsBalance, 
        discountAmount: data.discount_amount 
      };
      
    } catch (error) {
      console.error('Error redeeming points:', error);
      return { success: false, error: error.message };
    }
  }

  getTierInfo() {
    const currentTier = this.tiers[this.tier];
    const tierKeys = Object.keys(this.tiers);
    const currentTierIndex = tierKeys.indexOf(this.tier);
    const nextTier = tierKeys[currentTierIndex + 1];
    
    return {
      currentTier: {
        name: currentTier.name,
        points: this.pointsBalance,
        minPoints: currentTier.minPoints,
        discount: currentTier.discount * 100
      },
      nextTier: nextTier ? {
        name: this.tiers[nextTier].name,
        minPoints: this.tiers[nextTier].minPoints,
        pointsNeeded: this.tiers[nextTier].minPoints - this.pointsBalance
      } : null,
      progress: nextTier 
        ? (this.pointsBalance / this.tiers[nextTier].minPoints) * 100 
        : 100
    };
  }

  // UI Update Methods
  updateUIBalance() {
    const balanceElement = document.getElementById('pointsBalance');
    if (balanceElement) {
      balanceElement.textContent = this.pointsBalance;
    }
  }

  updateUITier() {
    const tierInfo = this.getTierInfo();
    const tierElement = document.getElementById('loyaltyTier');
    const tierNameElement = document.getElementById('currentTierName');
    const tierBadgeElement = document.getElementById('currentTierBadge');
    const progressBar = document.getElementById('tierProgressBar');
    const nextTierProgress = document.getElementById('nextTierProgress');
    const pointsToNextTier = document.getElementById('pointsToNextTier');
    
    if (tierElement) {
      // Remove all tier classes
      Object.keys(this.tiers).forEach(tier => {
        tierElement.classList.remove(`tier-${tier}`);
      });
      // Add current tier class
      tierElement.classList.add(`tier-${this.tier}`);
      
      // Update tier name
      const tierName = tierElement.querySelector('span:last-child');
      if (tierName) {
        tierName.textContent = tierInfo.currentTier.name;
      }
    }
    
    // Update modal elements
    if (tierNameElement) {
      tierNameElement.textContent = tierInfo.currentTier.name;
    }
    
    if (tierBadgeElement) {
      // Remove all tier classes
      Object.keys(this.tiers).forEach(tier => {
        tierBadgeElement.classList.remove(`tier-${tier}`);
      });
      // Add current tier class
      tierBadgeElement.classList.add(`tier-${this.tier}`);
      
      // Update tier name
      const badgeName = tierBadgeElement.querySelector('span:last-child');
      if (badgeName) {
        badgeName.textContent = tierInfo.currentTier.name;
      }
    }
    
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, tierInfo.progress)}%`;
    }
    
    if (nextTierProgress && tierInfo.nextTier) {
      nextTierProgress.textContent = `${this.pointsBalance}/${tierInfo.nextTier.minPoints} punti`;
    }
    
    if (pointsToNextTier && tierInfo.nextTier) {
      pointsToNextTier.textContent = `${tierInfo.nextTier.pointsNeeded} punti`;
    }
    
    // Update tier benefits
    this.updateTierBenefits();
  }

  updateTierBenefits() {
    const benefitsList = document.getElementById('tierBenefitsList');
    if (!benefitsList) return;
    
    const tierBenefits = this.getTierBenefits(this.tier);
    benefitsList.innerHTML = tierBenefits.map(benefit => `
      <div class="tier-benefit">
        <i class="fas fa-check-circle"></i>
        <span>${benefit}</span>
      </div>
    `).join('');
  }

  getTierBenefits(tier) {
    const benefits = {
      bronze: [
        '1 punto ogni 1€ speso',
        '5% di sconto su acquisti con punti',
        'Accesso alle offerte esclusive'
      ],
      silver: [
        '1.2 punti ogni 1€ speso',
        '7% di sconto su acquisti con punti',
        'Accesso anticipato ai saldi',
        'Spedizione gratuita sopra 50€'
      ],
      gold: [
        '1.5 punti ogni 1€ speso',
        '10% di sconto su acquisti con punti',
        'Accesso VIP ai nuovi arrivi',
        'Spedizione gratuita sopra 30€',
        'Reso gratuito di 30 giorni'
      ],
      platinum: [
        '2 punti ogni 1€ speso',
        '15% di sconto su acquisti con punti',
        'Accesso in anteprima alle collezioni',
        'Spedizione gratuita illimitata',
        'Reso gratuito di 60 giorni',
        'Assistenza dedicata 24/7',
        'Inviti esclusivi agli eventi'
      ]
    };
    
    // Return all benefits up to and including the current tier
    const result = [];
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const currentTierIndex = tierOrder.indexOf(tier);
    
    for (let i = 0; i <= currentTierIndex; i++) {
      const currentTier = tierOrder[i];
      if (i === currentTierIndex) {
        // For the current tier, show all benefits
        result.push(...benefits[currentTier]);
      } else {
        // For previous tiers, show only the first two benefits
        result.push(...benefits[currentTier].slice(0, 2));
      }
    }
    
    return result;
  }

  updateUITransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    if (this.transactions.length === 0) {
      transactionsList.innerHTML = '<div class="no-transactions">Nessuna transazione recente</div>';
      return;
    }
    
    transactionsList.innerHTML = this.transactions.map(transaction => `
      <div class="transaction-item">
        <div class="transaction-details">
          <span class="transaction-reason">${transaction.reason}</span>
          <span class="transaction-date">${new Date(transaction.created_at).toLocaleDateString()}</span>
        </div>
        <div class="transaction-amount ${transaction.points > 0 ? 'positive' : 'negative'}">
          ${transaction.points > 0 ? '+' : ''}${transaction.points} pts
        </div>
      </div>
    `).join('');
  }
}

// Initialize loyalty system when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const client = getSupaClient();
  if (!client) return;
  
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  // Initialize loyalty system
  window.loyaltySystem = new LoyaltySystem(user.id);
  await window.loyaltySystem.init();

  // Setup event listeners
  const showTiersBtn = document.getElementById('showTiersBtn');
  const modal = document.getElementById('tiersModal');
  const closeBtn = modal?.querySelector('.modal-close');
  
  showTiersBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'block';
  });
  
  closeBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
