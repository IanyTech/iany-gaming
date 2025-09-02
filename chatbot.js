// Chatbot functionality
class IanyChatbot {
  constructor() {
    this.chatbot = document.getElementById('chatbot');
    this.chatbotToggle = document.getElementById('chatbotToggle');
    this.chatbotPanel = document.querySelector('.chatbot-panel');
    this.chatbotMessages = document.getElementById('chatbotMessages');
    this.chatbotForm = document.getElementById('chatbotForm');
    this.chatbotText = document.getElementById('chatbotText');
    this.chatbotReset = document.getElementById('chatbotReset');
    this.chatbotClose = document.getElementById('chatbotClose');
    
    // Quick replies and greetings (will be localized via t())
    this.greetings = [
      this.t('chat.greet1', 'Ciao! Come posso aiutarti oggi?'),
      this.t('chat.greet2', 'Salve! Hai bisogno di informazioni su un prodotto?'),
      this.t('chat.greet3', 'Buongiorno! Come posso esserti utile?')
    ];
    
    this.quickReplies = [
      this.t('chat.qr_shipping', 'Quanto costa la spedizione?'),
      this.t('chat.qr_giftcards', 'Avete gift card?'),
      this.t('chat.qr_returns', 'Come funziona il reso?'),
      this.t('chat.qr_search', 'Cercavo un gioco specifico')
    ];
    
    // Ensure the panel starts hidden for a11y and layout
    if (this.chatbotPanel) {
      this.chatbotPanel.hidden = true;
      this.chatbotPanel.removeAttribute('open');
      this.chatbotPanel.style.visibility = 'hidden';
      this.chatbotPanel.style.opacity = '0';
      this.chatbotPanel.style.transform = 'translateY(20px)';
    }

    this.initialize();
    // Restore past conversation
    this.restoreState();
  }

  // Translate helper using global i18n when available
  t(key, fallback) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        const out = window.i18n.t(key);
        return out || fallback;
      }
    } catch {}
    return fallback;
  }
  
  initialize() {
    // Show/hide chat panel
    this.chatbotToggle.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleChat();
    });
    
    // Close button
    this.chatbotClose.addEventListener('click', () => this.hideChat());
    
    // Reset chat
    this.chatbotReset.addEventListener('click', (e) => {
      e.preventDefault();
      this.resetChat();
    });
    
    // Handle form submission
    this.chatbotForm.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Show welcome message if first visit
    if (!localStorage.getItem('chatbotSeen')) {
      setTimeout(() => this.showWelcomeMessage(), 1000);
      localStorage.setItem('chatbotSeen', 'true');
    }
    
    // Auto-hide after 15 seconds of inactivity
    this.inactivityTimer = setTimeout(() => this.hideChat(), 15000);
    
    // Reset inactivity timer on user action
    ['mousemove', 'keypress', 'click'].forEach(evt => {
      document.addEventListener(evt, () => this.resetInactivityTimer());
    });

    // Close on Escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.hideChat();
    });

    // Click outside to close
    document.addEventListener('click', (ev) => {
      const isOpen = this.chatbotPanel && this.chatbotPanel.getAttribute('open') !== null;
      if (!isOpen) return;
      const clickInsidePanel = ev.target.closest('.chatbot-panel');
      const clickOnToggle = ev.target.closest('#chatbotToggle');
      if (!clickInsidePanel && !clickOnToggle) {
        this.hideChat();
      }
    });
  }
  
  toggleChat() {
    const isOpen = this.chatbotPanel.getAttribute('open') !== null;
    if (isOpen) {
      this.hideChat();
    } else {
      this.showChat();
    }
  }
  
  showChat() {
    // reveal and mark open
    this.chatbotPanel.hidden = false;
    this.chatbotPanel.setAttribute('open', '');
    this.chatbotPanel.style.visibility = 'visible';
    this.chatbotPanel.style.opacity = '1';
    this.chatbotPanel.style.transform = 'translateY(0)';
    this.chatbotText.focus();
    this.resetInactivityTimer();
    // ARIA
    if (this.chatbotToggle) this.chatbotToggle.setAttribute('aria-expanded', 'true');
  }
  
  hideChat() {
    this.chatbotPanel.style.opacity = '0';
    this.chatbotPanel.style.transform = 'translateY(20px)';
    this.chatbotPanel.style.visibility = 'hidden';
    this.chatbotPanel.removeAttribute('open');
    // hide after transition to remove from a11y tree
    window.clearTimeout(this._hideT);
    this._hideT = window.setTimeout(() => {
      this.chatbotPanel.hidden = true;
    }, 220);
    // ARIA
    if (this.chatbotToggle) this.chatbotToggle.setAttribute('aria-expanded', 'false');
  }
  
  resetInactivityTimer() {
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => this.hideChat(), 15000);
  }
  
  showWelcomeMessage() {
    this.addBotMessage(this.getRandomGreeting());
    this.showQuickReplies();
  }
  
  showQuickReplies() {
    const replies = this.quickReplies
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    replies.forEach(reply => {
      const button = document.createElement('button');
      button.className = 'quick-reply';
      button.textContent = reply;
      button.addEventListener('click', () => {
        this.userMessage(reply);
        quickReplies.remove();
        this.processMessage(reply);
      });
      quickReplies.appendChild(button);
    });
    
    this.chatbotMessages.appendChild(quickReplies);
    this.scrollToBottom();
  }
  
  handleSubmit(e) {
    e.preventDefault();
    const message = this.chatbotText.value.trim();
    if (!message) return;
    
    this.userMessage(message);
    this.chatbotText.value = '';
    this.processMessage(message);
  }
  
  userMessage(message) {
    this.addMessage(message, 'user');
  }
  
  addBotMessage(message) {
    this.addMessage(message, 'bot');
  }
  
  addMessage(message, sender) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    const content = document.createElement('div');
    content.className = 'content';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message;

    const timeStamp = document.createElement('div');
    timeStamp.className = 'message-time';
    timeStamp.textContent = this.getCurrentTime();

    content.appendChild(bubble);
    content.appendChild(timeStamp);
    wrap.appendChild(avatar);
    wrap.appendChild(content);

    this.chatbotMessages.appendChild(wrap);
    this.scrollToBottom();
    
    // Remove any existing typing indicators
    const typing = this.chatbotMessages.querySelector('.typing-indicator');
    if (typing) typing.remove();

    // Persist message
    this.saveState();
  }
  
  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    this.chatbotMessages.appendChild(typingDiv);
    this.scrollToBottom();
    return typingDiv;
  }
  
  async processMessage(message) {
    // Show typing indicator
    const typing = this.showTypingIndicator();
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Remove typing indicator
    typing.remove();
    
    // Simple response logic - in a real app, this would call an API
    const lowerMsg = message.toLowerCase();
    let response = "Mi dispiace, non ho capito. Puoi riformulare la domanda?";
    
    if (lowerMsg.includes('ciao') || lowerMsg.includes('salve') || lowerMsg.includes('buongiorno')) {
      response = this.getRandomGreeting();
    } else if (lowerMsg.includes('spedizione') || lowerMsg.includes('consegna') || lowerMsg.includes('tempi')) {
      response = "Le spedizioni vengono effettuate entro 24-48 ore lavorative. Per l'Italia la consegna è gratuita per ordini superiori a 50€, altrimenti costa 4.90€. I tempi di consegna variano da 1 a 3 giorni lavorativi.";
    } else if (lowerMsg.includes('gift') || lowerMsg.includes('regalo') || lowerMsg.includes('carta')) {
      response = "Sì, offriamo carte regalo digitali per varie piattaforme come Steam, PlayStation, Xbox e Nintendo. Puoi trovarle nella sezione 'Gift Card' del nostro negozio. Le ricevi via email subito dopo l'acquisto!";
    } else if (lowerMsg.includes('res') || lowerMsg.includes('rimborso') || lowerMsg.includes('restituzione')) {
      response = "Hai 14 giorni per restituire i prodotti acquistati. I resi sono gratuiti e il rimborso avviene entro 14 giorni dal ricevimento del reso. Per avviare un reso, contattaci tramite l'apposito modulo nella sezione 'Contatti'.";
    } else if (lowerMsg.includes('gioco') || lowerMsg.includes('cercavo')) {
      response = "Certo! Puoi cercare i giochi utilizzando la barra di ricerca in alto. Se non trovi quello che cerchi, fammi sapere il titolo e ti aiuterò a verificare la disponibilità o a suggerirti alternative simili.";
    }
    
    this.addBotMessage(response);
    
    // Show quick replies after bot response
    if (Math.random() > 0.5) {
      setTimeout(() => this.showQuickReplies(), 500);
    }
  }
  
  resetChat() {
    this.chatbotMessages.innerHTML = '';
    this.addBotMessage(this.t('chat.reset', 'La conversazione è stata riavviata. Come posso aiutarti?'));
    this.showQuickReplies();
    this.saveState();
  }
  
  getRandomGreeting() {
    return this.greetings[Math.floor(Math.random() * this.greetings.length)];
  }
  
  getCurrentTime() {
    return new Date().toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }
  
  scrollToBottom() {
    this.chatbotMessages.scrollTop = this.chatbotMessages.scrollHeight;
  }

  // Save/restore conversation state
  saveState() {
    try {
      const msgs = Array.from(this.chatbotMessages.querySelectorAll('.msg'))
        .map(node => ({
          sender: node.classList.contains('user') ? 'user' : 'bot',
          text: node.querySelector('.bubble')?.textContent || ''
        }));
      localStorage.setItem('iany_chat_state', JSON.stringify(msgs));
    } catch {}
  }

  restoreState() {
    try {
      const raw = localStorage.getItem('iany_chat_state');
      if (!raw) return;
      const msgs = JSON.parse(raw);
      if (!Array.isArray(msgs) || !msgs.length) return;
      this.chatbotMessages.innerHTML = '';
      msgs.forEach(m => this.addMessage(m.text, m.sender === 'user' ? 'user' : 'bot'));
    } catch {}
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if elements exist
  if (document.getElementById('chatbot')) {
    window.ianyChatbot = new IanyChatbot();
  }
});
