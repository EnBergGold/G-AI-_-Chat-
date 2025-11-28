// Load the LinguistDetector script properly
function loadLinguistDetector() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'linguist-detector.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

class DeepSeekChat {
  constructor() {
    console.log('DeepSeekChat constructor called');
    
    // Check if an instance already exists
    if (window.deepSeekChat) {
      console.warn('DeepSeekChat instance already exists, returning existing instance');
      return window.deepSeekChat;
    }
    
    this.conversationId = this.generateId();
    console.log('Generated conversationId:', this.conversationId);
    
    this.sessionId = this.generateId();
    console.log('Generated sessionId:', this.sessionId);
    
    this.isProcessing = false;
    this.isMobile = window.innerWidth <= 768;
    this.scrollThreshold = 200; // Расстояние от низа, при котором показывается кнопка
    this.forwardText = ''; // Текст для пересылки
    this.attachedFiles = []; // Массив прикреплённых файлов
    
    console.log('isMobile:', this.isMobile);
    
    // Initialize the Linguist detector
    this.linguistDetector = null;
    if (typeof LinguistDetector !== 'undefined') {
      this.linguistDetector = new LinguistDetector();
      console.log('LinguistDetector initialized');
    } else {
      console.warn('LinguistDetector not yet available, will initialize when ready');
    }
    
    console.log('Calling initializeChat');
    this.initializeChat();
    
    console.log('Calling setupEventListeners');
    this.setupEventListeners();
    
    console.log('Calling setupScrollHandler');
    this.setupScrollHandler();
    
    console.log('DeepSeekChat constructor finished');
  }
  generateId() {
    return 'conv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  initializeChat() {
    console.log('initializeChat called');
    this.setWelcomeTime();
    this.adjustTextareaHeight();
    
    // Убедимся, что isProcessing установлен в false при инициализации
    this.isProcessing = false;
    console.log('isProcessing set to false in initializeChat');
    this.updateSendButton();
    
    console.log('initializeChat finished');
  }

  setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Simple and direct approach
    const setupListeners = () => {
      const sendButton = document.getElementById('send-button');
      const messageInput = document.getElementById('message-input');
      const attachButton = document.getElementById('attach-button');
      const fileInput = document.getElementById('file-input');
      const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
      
      console.log('Elements found:', { sendButton, messageInput, attachButton, fileInput, scrollToBottomBtn });
      
      // Check if all required elements are available
      if (!sendButton || !messageInput || !attachButton || !fileInput) {
        console.error('Some required elements are missing from the DOM');
        return false;
      }
      
      // Remove any existing event listeners by detaching and reattaching
      sendButton.onclick = null;
      messageInput.onkeydown = null;
      messageInput.oninput = null;
      attachButton.onclick = null;
      fileInput.onchange = null;
      if (scrollToBottomBtn) {
        scrollToBottomBtn.onclick = null;
      }
      
      console.log('Removed existing event listeners');
      
      // Send button event listener
      sendButton.onclick = (e) => {
        console.log('Send button clicked, calling sendMessage');
        e.preventDefault();
        e.stopPropagation();
        this.sendMessage();
        return false;
      };
      
      // Message input keydown event listener
      messageInput.onkeydown = (e) => {
        console.log('keydown event:', e.key, 'shiftKey:', e.shiftKey);
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Enter key pressed without shift, calling sendMessage');
          this.sendMessage();
          return false;
        }
      };
      
      // Message input input event listener
      messageInput.oninput = (e) => {
        console.log('Input event triggered');
        this.adjustTextareaHeight();
        this.updateSendButton();
      };

      // Message input paste event listener for files
      messageInput.onpaste = (e) => {
        console.log('Paste event triggered');
        const files = e.clipboardData.files;
        if (files.length > 0) {
          e.preventDefault();
          for (let i = 0; i < files.length; i++) {
            this.addAttachedFile(files[i]);
          }
        }
      };
      
      // Attach button event listener
      attachButton.onclick = (e) => {
        console.log('Attach button clicked, triggering file input');
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
        return false;
      };
      
      // File input change event listener
      fileInput.onchange = (e) => {
        console.log('File input changed, handling file select');
        this.handleFileSelect(e);
      };
      
      // Scroll to bottom button event listener
      if (scrollToBottomBtn) {
        scrollToBottomBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.scrollToBottom();
          return false;
        };
      }
      
      // Initial update of send button state
      this.updateSendButton();
      
      // Mobile handlers
      if (this.isMobile) {
        this.setupMobileHandlers();
      }
      
      console.log('Event listeners setup complete');
      return true;
    };
    
    // Try to set up listeners immediately
    if (!setupListeners()) {
      // If failed, try again after a short delay
      setTimeout(() => {
        if (!setupListeners()) {
          // If still failed, try one more time
          setTimeout(setupListeners, 500);
        }
      }, 100);
    }
  }

  setupScrollHandler() {
    const messagesContainer = document.getElementById('messages-container');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    
    messagesContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // Также отслеживаем resize для пересчета позиции
    window.addEventListener('resize', () => {
      this.handleScroll();
    });

    // Инициализируем проверку скролла при загрузке
    setTimeout(() => {
      this.handleScroll();
    }, 100);
  }
  
  // Method to manually re-attach event listeners
  reattachEventListeners() {
    console.log('Re-attaching event listeners');
    this.setupEventListeners();
  }

  handleScroll() {
    const messagesContainer = document.getElementById('messages-container');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    
    const scrollTop = messagesContainer.scrollTop;
    const scrollHeight = messagesContainer.scrollHeight;
    const clientHeight = messagesContainer.clientHeight;
    
    // Показываем кнопку, если пользователь прокрутил вверх больше чем на scrollThreshold от низа
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    if (distanceFromBottom > this.scrollThreshold) {
      scrollToBottomBtn.classList.add('visible');
    } else {
      scrollToBottomBtn.classList.remove('visible');
    }
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
    
    // Скрываем кнопку после прокрутки
    setTimeout(() => {
      scrollToBottomBtn.classList.remove('visible');
    }, 300);
  }

  setupMobileHandlers() {
    const messageInput = document.getElementById('message-input');
    const inputContainer = document.getElementById('input-container');
    
    messageInput.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });

    inputContainer.addEventListener('click', (e) => {
      if (e.target === inputContainer || e.target.classList.contains('input-wrapper')) {
        e.preventDefault();
        this.focusInput();
      }
    });

    messageInput.addEventListener('blur', () => {
      console.log('Input blurred, but remains clickable');
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.adjustTextareaHeight();
        this.ensureInputAccessible();
        // Пересчитываем позицию кнопки после изменения ориентации
        this.handleScroll();
      }, 300);
    });
  }

  focusInput() {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      setTimeout(() => {
        try {
          messageInput.focus();
          console.log('Input focused programmatically');
        } catch (e) {
          console.log('Focus error:', e);
        }
      }, 50);
    }
  }

  ensureInputAccessible() {
    const messageInput = document.getElementById('message-input');
    if (messageInput && this.isMobile) {
      messageInput.style.pointerEvents = 'auto';
      messageInput.style.touchAction = 'auto';
      messageInput.style.webkitUserSelect = 'text';
      messageInput.style.userSelect = 'text';
    }
  }

  setWelcomeTime() {
    const now = new Date();
    document.getElementById('welcome-time').textContent = 
      now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        this.addAttachedFile(files[i]);
      }
      event.target.value = '';
    }
  }

  addAttachedFile(file) {
    // Добавляем уникальный ID файлу
    file.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.attachedFiles.push(file);
    this.addFilePreview(file);
    this.updateSendButton();
  }

  addFilePreview(file) {
    const previewsContainer = document.getElementById('file-previews');
    const previewElement = document.createElement('div');
    previewElement.className = 'file-preview';
    previewElement.dataset.fileId = file.id;

    const fileSize = this.formatFileSize(file.size);
    const fileIcon = this.getFileIcon(file.type);
    const isImage = file.type.startsWith('image/');
    const fileExtension = file.name.split('.').pop().toUpperCase();

    let iconHtml = '';
    if (isImage) {
      // Для изображений создаём миниатюру
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = previewElement.querySelector('.file-preview-icon img');
        if (img) img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      iconHtml = '<img src="" alt="preview">';
    } else {
      // Для других файлов используем иконку
      iconHtml = fileIcon;
    }

    previewElement.innerHTML = `
      <div class="file-preview-icon">
        ${iconHtml}
      </div>
      <div class="file-preview-info">
        <span class="file-preview-format">${fileExtension}</span>
        <div class="file-preview-name">${this.escapeHtml(file.name)}</div>
        <div class="file-preview-size">${fileSize}</div>
      </div>
      <button class="file-preview-remove" data-file-id="${file.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Обработчик удаления
    const removeBtn = previewElement.querySelector('.file-preview-remove');
    removeBtn.addEventListener('click', () => {
      this.removeAttachedFile(file.id);
    });

    previewsContainer.appendChild(previewElement);
  }

  removeAttachedFile(fileId) {
    // Удаляем из массива
    this.attachedFiles = this.attachedFiles.filter(f => f.id !== fileId);

    // Удаляем предпросмотр
    const previewElement = document.querySelector(`.file-preview[data-file-id="${fileId}"]`);
    if (previewElement) {
      previewElement.remove();
    }

    // Обновляем состояние кнопки отправки
    this.updateSendButton();
  }

  clearAttachedFiles() {
    this.attachedFiles = [];
    document.getElementById('file-previews').innerHTML = '';
  }


  addFileMessage(file) {
    console.log('addFileMessage called for file:', file.name, 'type:', file.type, 'size:', file.size);
    // Конвертируем файл в base64
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log('FileReader onload for', file.name, 'base64Data length:', e.target.result.length);
      const base64Data = e.target.result;
    const messagesContainer = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    
    const timestamp = new Date().toLocaleTimeString('ru-RU', { 
      hour: '2-digit', minute: '2-digit' 
    });

    const fileSize = this.formatFileSize(file.size);
    const fileIcon = this.getFileIcon(file.type);
    const fileExtension = file.name.split('.').pop().toUpperCase();
    const messageId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Определяем тип файла для предпросмотра
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isPDF = file.type === 'application/pdf';
    const isText = file.type.startsWith('text/') || ['json', 'xml', 'csv'].includes(fileExtension.toLowerCase());
    const is3DModel = ['stl', 'usdz'].includes(fileExtension.toLowerCase());

    // Определяем, поддерживается ли файл для копирования в буфер обмена
    const isCopyable = isImage || file.type === 'text/plain' || file.type === 'text/html';

    messageDiv.innerHTML = `
      <div class="avatar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" fill="white"/>
          <path d="M12 14C9.79086 14 4 15.7909 4 18V20H20V18C20 15.7909 14.2091 14 12 14Z" fill="white"/>
        </svg>
      </div>
      <div class="message-content file-message-content">
        <div class="file-header">
          <div class="file-info">
            <span class="file-type">${fileExtension}</span>
          </div>
          ${isCopyable ? `<button class="download-file-btn" data-message-id="${messageId}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Скачать
          </button>` : ''}
        </div>
        <div class="message-text">
          ${isImage ? `
            <div style="margin-bottom: 8px;">
              <img src="${base64Data}" alt="${this.escapeHtml(file.name)}" style="max-width: 100%; max-height: min(300px, 40vh); border-radius: 8px; display: block; object-fit: contain;" />
            </div>
          ` : isVideo ? `
            <div style="margin-bottom: 8px;">
              <video controls style="max-width: 100%; max-height: min(300px, 40vh); border-radius: 8px; display: block; background: #000;">
                <source src="${base64Data}" type="${file.type}">
                Ваш браузер не поддерживает видео.
              </video>
            </div>
          ` : isAudio ? `
            <div style="margin-bottom: 8px;">
              <audio controls style="width: 100%; border-radius: 8px;">
                <source src="${base64Data}" type="${file.type}">
                Ваш браузер не поддерживает аудио.
              </audio>
            </div>
          ` : isPDF ? `
            <div style="margin-bottom: 8px;">
              <iframe src="${base64Data}" style="width: 100%; height: min(400px, 50vh); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; background: white; box-sizing: border-box;"></iframe>
            </div>
          ` : isText ? `
            <div style="margin-bottom: 8px; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; max-height: min(300px, 40vh); overflow-y: auto;">
              <pre id="text-preview-${messageId}" style="margin: 0; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; line-height: 1.5; color: #e5e5e5; white-space: pre-wrap; word-wrap: break-word;">Загрузка...</pre>
            </div>
          ` : is3DModel ? `
            <div style="margin-bottom: 8px;">
              <div style="width: 100%; height: min(300px, 40vh); background: linear-gradient(135deg, rgba(31, 31, 31, 0.9) 0%, rgba(20, 20, 20, 0.9) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                <div style="text-align: center; color: rgba(255, 255, 255, 0.6);">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
                    <path d="M2 17L12 22L22 17"></path>
                    <path d="M2 12L12 17L22 12"></path>
                  </svg>
                  <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">Предпросмотр 3D модели</div>
                  <div style="font-size: 12px; opacity: 0.7;">${fileExtension.toUpperCase()} файл</div>
                  <div style="margin-top: 12px; font-size: 11px; opacity: 0.5;">Скачайте файл для просмотра в 3D приложении</div>
                </div>
              </div>
            </div>
          ` : ''}
          <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 8px;">
            ${fileIcon}
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; font-size: 13px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${this.escapeHtml(file.name)}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6);">${fileSize}</div>
            </div>
          </div>
        </div>
        <div class="message-time">${timestamp}</div>
      </div>
      ${isCopyable ? `<button class="message-copy-btn" data-message-id="${messageId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <button class="message-forward-btn" data-message-id="${messageId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </button>` : ''}
    `;

    messagesContainer.appendChild(messageDiv);

    // Для текстовых файлов загружаем содержимое
    if (isText) {
      this.loadTextPreview(base64Data, `text-preview-${messageId}`);
    }

    // Добавляем обработчик скачивания файла
    const downloadBtn = messageDiv.querySelector('.download-file-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.downloadFileFromBase64(downloadBtn, base64Data, file.name);
      });
    }

    // Обработчики для кнопок копирования и пересылки сообщения
    const messageCopyBtn = messageDiv.querySelector('.message-copy-btn');
    const messageForwardBtn = messageDiv.querySelector('.message-forward-btn');
    if (messageCopyBtn || messageForwardBtn) {
      const messageContent = messageDiv.querySelector('.message-content');
      if (messageContent) {
        const isUser = true; // Файлы всегда от пользователя
        const contentRect = messageContent.getBoundingClientRect();
        const messageRect = messageDiv.getBoundingClientRect();
        const top = contentRect.top - messageRect.top + 10;
        if (isUser) {
          // Для пользовательских сообщений - слева от контента
          const leftPos = (contentRect.left - messageRect.left - 34) + 'px';
          if (messageCopyBtn) {
            messageCopyBtn.style.left = leftPos;
            messageCopyBtn.style.right = 'auto';
            messageCopyBtn.style.top = top + 'px';
            messageCopyBtn.style.transform = 'none';
          }
          if (messageForwardBtn) {
            messageForwardBtn.style.left = leftPos;
            messageForwardBtn.style.right = 'auto';
            messageForwardBtn.style.top = (top + 32) + 'px'; // ниже на 32px
            messageForwardBtn.style.transform = 'none';
          }
        }

        // Для мобильной версии - показывать кнопки по тапу на сообщение
        if (this.isMobile) {
          messageContent.addEventListener('click', () => {
            if (messageCopyBtn) {
              messageCopyBtn.style.opacity = '1';
              messageCopyBtn.style.visibility = 'visible';
            }
            if (messageForwardBtn) {
              messageForwardBtn.style.opacity = '1';
              messageForwardBtn.style.visibility = 'visible';
            }
          });
        }
      }
    }

    if (messageCopyBtn) {
      messageCopyBtn.addEventListener('click', () => {
        console.log('Copy button clicked for file:', file.name);
        // Копируем файл в буфер обмена вместо текста названия
        this.copyFileToClipboard(messageCopyBtn, base64Data, file.name);
        // Для мобильной версии - скрыть кнопки после использования
        if (this.isMobile) {
          setTimeout(() => {
            messageCopyBtn.style.opacity = '0';
            messageCopyBtn.style.visibility = 'hidden';
          }, 2000);
        }
      });
    }

    if (messageForwardBtn) {
      messageForwardBtn.addEventListener('click', () => {
        const messageContent = messageDiv.querySelector('.message-content');
        const textToCopy = messageContent.querySelector('.message-text').textContent.trim();
        this.copyCode(messageForwardBtn, textToCopy);
        // Для мобильной версии - скрыть кнопки после использования
        if (this.isMobile) {
          setTimeout(() => {
            messageForwardBtn.style.opacity = '0';
            messageForwardBtn.style.visibility = 'hidden';
          }, 2000);
        }
      });
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    reader.readAsDataURL(file);
  }

  getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2"/></svg>';
    } else if (fileType.startsWith('video/')) {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 8V16L16 12L9 8Z" fill="currentColor"/></svg>';
    } else if (fileType.includes('pdf')) {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2"/><path d="M16 13H8" stroke="currentColor" stroke-width="2"/><path d="M16 17H8" stroke="currentColor" stroke-width="2"/><path d="M10 9H9H8" stroke="currentColor" stroke-width="2"/></svg>';
    } else if (fileType.startsWith('model/') || fileType.includes('stl') || fileType.includes('usdz')) {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    } else {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2"/></svg>';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  loadTextPreview(base64Data, elementId) {
    try {
      // Извлекаем текстовое содержимое из base64
      const base64Match = base64Data.match(/data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,([A-Za-z0-9+/=]+)/);
      
      if (base64Match) {
        const base64String = base64Match[1];
        const decodedText = atob(base64String);
        
        const previewElement = document.getElementById(elementId);
        if (previewElement) {
          // Ограничиваем предпросмотр первыми 5000 символами
          const maxLength = 5000;
          const displayText = decodedText.length > maxLength 
            ? decodedText.substring(0, maxLength) + '\n\n... (файл обрезан для предпросмотра)'
            : decodedText;
          
          previewElement.textContent = displayText;
          // Прокручиваем вниз после загрузки содержимого
          setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 0);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки текстового предпросмотра:', err);
      const previewElement = document.getElementById(elementId);
      if (previewElement) {
        previewElement.textContent = 'Не удалось загрузить предпросмотр файла.';
        // Прокручиваем вниз после установки сообщения об ошибке
        setTimeout(() => {
          const messagesContainer = document.getElementById('messages-container');
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 0);
      }
    }
  }

  adjustTextareaHeight() {
    const textarea = document.getElementById('message-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  updateSendButton() {
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');

    // Кнопка активна, если есть текст ИЛИ файлы, и не обрабатывается
    const hasContent = messageInput.value.trim().length > 0 || this.attachedFiles.length > 0;
    sendButton.disabled = !hasContent || this.isProcessing;
  }

  addMessage(text, sender) {
    const messagesContainer = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const timestamp = new Date().toLocaleTimeString('ru-RU', { 
      hour: '2-digit', minute: '2-digit' 
    });

    const avatarContent = sender === 'user' 
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" fill="white"/><path d="M12 14C9.79086 14 4 15.7909 4 18V20H20V18C20 15.7909 14.2091 14 12 14Z" fill="white"/></svg>'
      : '';
    
    const avatarClass = sender === 'user' ? 'avatar' : 'avatar ai-avatar-gradient';

    // Определяем, содержит ли сообщение файл
    const fileDetection = this.detectFile(text);
    // Определяем, содержит ли сообщение URL
    const urlDetection = this.detectURL(text);
    // Определяем, содержит ли сообщение код (приоритет кода над URL)
    const codeDetection = this.detectCode(text);
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
      <div class="${avatarClass}">
        ${avatarContent}
      </div>
      <div class="message-content">
        ${fileDetection.isFile ? `
          <div class="file-header">
            <div class="file-info">
              <span class="file-type">${fileDetection.extension}</span>
            </div>
            <button class="download-file-btn" data-message-id="${messageId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Скачать
            </button>
          </div>
          <div class="message-text">
            <div>${this.escapeHtml(text)}</div>
          </div>
        ` : codeDetection.isCode ? `
          <div class="code-header">
            <span class="code-language">${codeDetection.language}</span>
            <button class="copy-code-btn" data-message-id="${messageId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Копировать
            </button>
          </div>
          <div class="message-text">
            <pre><code id="${messageId}" class="language-${this.getPrismLanguageClass(codeDetection.language)}"></code></pre>
          </div>
        ` : urlDetection.isURL ? `
          <div class="code-header">
            <span class="code-language" style="color: #ff6900;">URL</span>
            <div class="url-recognition-block">
              ${urlDetection.multiple ? '' : `
              <button class="url-go-btn" data-message-id="${messageId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Перейти
              </button>`}
              <button class="copy-code-btn" data-message-id="${messageId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Копировать
              </button>
            </div>
          </div>
          <div class="message-text">
            <div>${this.escapeHtml(text)}</div>
          </div>
        ` : `
          <div class="message-text">
            <div>${this.escapeHtml(text)}</div>
          </div>
        `}
        <div class="message-time">${timestamp}</div>
      </div>
      ${!codeDetection.isCode && !fileDetection.isFile ? `
        <button class="message-copy-btn" data-message-id="${messageId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="message-forward-btn" data-message-id="${messageId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      ` : ''}
    `;

    messagesContainer.appendChild(messageDiv);

    // Если это файл, добавляем обработчик скачивания
    if (fileDetection.isFile) {
      const downloadBtn = messageDiv.querySelector('.download-file-btn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => this.downloadFile(downloadBtn, text, fileDetection.filename));
      }
    }
    
    // Если это код, устанавливаем текст после вставки в DOM
    if (codeDetection.isCode) {
      const codeElement = document.getElementById(messageId);
      if (codeElement) {
        codeElement.textContent = text;
        // Применяем подсветку синтаксиса с помощью Prism.js
        if (typeof Prism !== 'undefined') {
          Prism.highlightElement(codeElement);
        }
      }

      // Добавляем обработчик клика на кнопку
      const copyBtn = messageDiv.querySelector('.copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this.copyCode(copyBtn, text));
      }
    }

    // Обработчики для кнопок копирования и пересылки сообщения
    const messageCopyBtn = messageDiv.querySelector('.message-copy-btn');
    const messageForwardBtn = messageDiv.querySelector('.message-forward-btn');
    if (messageCopyBtn || messageForwardBtn) {
      const messageContent = messageDiv.querySelector('.message-content');
      if (messageContent) {
        const isUser = sender === 'user';
        const contentRect = messageContent.getBoundingClientRect();
        const messageRect = messageDiv.getBoundingClientRect();
        const top = contentRect.top - messageRect.top + 10;
        if (isUser) {
          // Для пользовательских сообщений - слева от контента
          const leftPos = (contentRect.left - messageRect.left - 34) + 'px';
          if (messageCopyBtn) {
            messageCopyBtn.style.left = leftPos;
            messageCopyBtn.style.right = 'auto';
            messageCopyBtn.style.top = top + 'px';
            messageCopyBtn.style.transform = 'none';
          }
          if (messageForwardBtn) {
            messageForwardBtn.style.left = leftPos;
            messageForwardBtn.style.right = 'auto';
            messageForwardBtn.style.top = (top + 32) + 'px'; // ниже на 32px
            messageForwardBtn.style.transform = 'none';
          }
        } else {
          // Для AI сообщений - справа от контента, сдвинуто на 12px влево
          const leftPos = (contentRect.left - messageRect.left + contentRect.width - 2) + 'px';
          if (messageCopyBtn) {
            messageCopyBtn.style.left = leftPos;
            messageCopyBtn.style.right = 'auto';
            messageCopyBtn.style.top = top + 'px';
            messageCopyBtn.style.transform = 'none';
          }
          if (messageForwardBtn) {
            messageForwardBtn.style.left = leftPos;
            messageForwardBtn.style.right = 'auto';
            messageForwardBtn.style.top = (top + 32) + 'px'; // ниже на 32px
            messageForwardBtn.style.transform = 'none';
          }
        }

        // Для мобильной версии - показывать кнопки по тапу на сообщение
        if (this.isMobile) {
          messageContent.addEventListener('click', () => {
            if (messageCopyBtn) {
              messageCopyBtn.style.opacity = '1';
              messageCopyBtn.style.visibility = 'visible';
            }
            if (messageForwardBtn) {
              messageForwardBtn.style.opacity = '1';
              messageForwardBtn.style.visibility = 'visible';
            }
          });
        }
      }
    }

    if (messageCopyBtn) {
      messageCopyBtn.addEventListener('click', () => {
        const messageContent = messageDiv.querySelector('.message-content');
        const textToCopy = messageContent.querySelector('.message-text').textContent.trim();
        this.copyCode(messageCopyBtn, textToCopy);
        // Для мобильной версии - скрыть кнопки после использования
        if (this.isMobile) {
          setTimeout(() => {
            messageCopyBtn.style.opacity = '0';
            messageCopyBtn.style.visibility = 'hidden';
          }, 2000);
        }
      });
    }

    if (messageForwardBtn) {
      messageForwardBtn.addEventListener('click', () => {
        const messageContent = messageDiv.querySelector('.message-content');
        const textToCopy = messageContent.querySelector('.message-text').textContent.trim();
        this.copyCode(messageForwardBtn, textToCopy);
        // Для мобильной версии - скрыть кнопки после использования
        if (this.isMobile) {
          setTimeout(() => {
            messageForwardBtn.style.opacity = '0';
            messageForwardBtn.style.visibility = 'hidden';
          }, 2000);
        }
      });
    }
      
    // Если это URL, добавляем обработчики для кнопок
    if (urlDetection.isURL) {
      // Для множественных URL - только кнопка "Копировать"
      if (urlDetection.multiple) {
        const copyBtn = messageDiv.querySelector('.copy-code-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            // Копируем все URL, разделенные новой строкой
            this.copyCode(copyBtn, urlDetection.urls.join('\n'));
          });
        }
      } else {
        // Для одной URL - обе кнопки: "Перейти" и "Копировать"
        const goBtn = messageDiv.querySelector('.url-go-btn');
        const copyBtn = messageDiv.querySelector('.copy-code-btn');
        
        if (goBtn) {
          goBtn.addEventListener('click', () => {
            window.open(urlDetection.url, '_blank');
            // Добавляем класс visited для визуального эффекта
            goBtn.classList.add('visited');
          });
        }
        
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            this.copyCode(copyBtn, urlDetection.url);
          });
        }
      }
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    // Заменяем символы новой строки на <br> теги
    return div.innerHTML.replace(/\n/g, '<br>');
  }


  resolveConflicts(matches, conflictPairs, text) {
    // Для каждого конфликтующего набора языков
    for (const pair of conflictPairs) {
      // Проверяем, есть ли оба языка в совпадениях
      const hasLang1 = matches.some(m => m.lang === pair.lang1);
      const hasLang2 = matches.some(m => m.lang === pair.lang2);
      
      if (hasLang1 && hasLang2) {
        // Определяем специфичные паттерны для каждого языка
        let lang1Specific, lang2Specific;
        
        if (pair.lang1 === 'csharp' && pair.lang2 === 'java') {
          lang1Specific = /#region|#endregion|@\w+\s+=[^=]|\.cs$|\.csproj$|\.NET\s+Core|\.NET\s+Framework|Console\.(Write|WriteLine)|Debug\.(Write|WriteLine)|using\s+System|struct\s+\w+\s*{|;\s*\/\/|\/\*[\s\S]*?\*\/|public\s+class|internal\s+class|namespace\s+[A-Z]\w+/;
          lang2Specific = /@Override|@Deprecated|@SuppressWarnings|\.java$|System\.(out|err)\.(print|println)|import\s+java\.|package\s+[a-z]|public\s+static\s+void\s+main\s*\(\s*String\[\]\s*\w+\s*\)/;
        } else if (pair.lang1 === 'csharp' && pair.lang2 === 'ruby') {
          lang1Specific = /#region|#endregion|@\w+\s+=[^=]|\.cs$|\.csproj$|\.NET\s+Core|\.NET\s+Framework|Console\.(Write|WriteLine)|Debug\.(Write|WriteLine)|using\s+System|struct\s+\w+\s*{|;\s*\/\/|\/\*[\s\S]*?\*\/|public\s+class|internal\s+class|namespace\s+[A-Z]\w+/;
          lang2Specific = /\b(def\s+\w+|end\b|class\s+\w+|module\s+\w+|require\s+['"][^'"]+['"]|puts\b|attr_accessor\s+:\w+|attr_reader\s+:\w+)\b|\bdo\s*\|\w+(,\s*\w+)*\|\s*$|\.rb$|#!.*ruby|\b(begin|rescue|ensure|raise)\b|:\w+\s*=>\s*|@\w+\s+=[^=]|\b(instance_variable_get|instance_variable_set)\b/;
        } else if (pair.lang1 === 'java' && pair.lang2 === 'ruby') {
          lang1Specific = /@Override|@Deprecated|@SuppressWarnings|\.java$|System\.(out|err)\.(print|println)|import\s+java\.|package\s+[a-z]|public\s+static\s+void\s+main\s*\(\s*String\[\]\s*\w+\s*\)/;
          lang2Specific = /\b(def\s+\w+|end\b|class\s+\w+|module\s+\w+|require\s+['"][^'"]+['"]|puts\b|attr_accessor\s+:\w+|attr_reader\s+:\w+)\b|\bdo\s*\|\w+(,\s*\w+)*\|\s*$|\.rb$|#!.*ruby|\b(begin|rescue|ensure|raise)\b|:\w+\s*=>\s*|@\w+\s+=[^=]|\b(instance_variable_get|instance_variable_set)\b/;
        } else if (pair.lang1 === 'python' && pair.lang2 === 'ruby') {
          lang1Specific = /\b(def\s+\w+\s*\(\s*\w*\s*\)|class\s+\w+\s*[:,]|import\s+\w+|from\s+\w+\s+import|if\s+__name__\s*==\s*['"]__main__['"]|print\s*\(|range\s*\(|len\s*\(|str\s*\(|int\s*\(|float\s*\(|list\s*\(|dict\s*\(|tuple\s*\(|set\s*\(|lambda\s*:|self\.|__init__\s*\(|__str__\s*\(|__repr__\s*\(|@staticmethod|@classmethod|@property|with\s+open\s*\(|try\s*:|except\s+:|finally\s*:|raise\s+\w+|assert\s+\w+|yield\s+\w+|async\s+def|await\s+\w+|__name__\s*==\s*['"]__main__['"]|@\w+\s*\(|\[\s*\]\s*=|\.py$)\b|:\s*=\s*|\.\.\.|nonlocal\s+\w+|global\s+\w+|f['"].*['"]/;
          lang2Specific = /\b(def\s+\w+\s*\|[^|]*\|)\b|\bend\b|class\s+\w+\s*$|module\s+\w+|require\s+['"][^'"]+['"]|puts\b|attr_accessor\s+:\w+|attr_reader\s+:\w+|attr_writer\s+:\w+|\bdo\s*\|\w+(,\s*\w+)*\|\s*$|\.rb$|#!.*ruby|\b(begin|rescue|ensure|raise)\b|:\w+\s*=>\s*|@\w+\s+=[^=]|\b(instance_variable_get|instance_variable_set|define_method)\b|\$\w+\s*=|\b(yield\s+\w*|block_given\?)\b|\.new\s*\(|\b(module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/;
        } else if (pair.lang1 === 'php' && pair.lang2 === 'ruby') {
          lang1Specific = /<\?php|<\?=|\$[a-zA-Z_][a-zA-Z0-9_]+\s*=|\becho\b|\bprint\b|\bprint_r\b|\bvar_dump\b|\bfunction\s+\w+\s*\(|\bclass\s+\w+|\bpublic\s+function|\bprivate\s+function|\bprotected\s+function|->\w+|::\w+|\bnamespace\s+|\buse\s+.*\\|\brequire(_once)?\s*[\("']|\binclude(_once)?\s*[\("'](?![<"])|\$this->|\bnew\s+\w+\s*\(|\bextends\s+\w+|\bimplements\s+\w+|\barray\s*\(|\b(foreach|endif|endwhile|endfor|elseif)\b|=>|\?>/;
          lang2Specific = /\b(def\s+\w+\s*\|[^|]*\|)\b|\bend\b|class\s+\w+\s*$|module\s+\w+|require\s+['"][^'"]+['['"]|puts\b|attr_accessor\s+:\w+|attr_reader\s+:\w+|attr_writer\s+:\w+|\bdo\s*\|\w+(,\s*\w+)*\|\s*$|\.rb$|#!.*ruby|\b(begin|rescue|ensure|raise)\b|:\w+\s*=>\s*|@\w+\s+=[^=]|\b(instance_variable_get|instance_variable_set|define_method)\b|\$\w+\s*=|\b(yield\s+\w*|block_given\?)\b|\.new\s*\(|\b(module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/;
        } else if (pair.lang1 === 'java' && pair.lang2 === 'php') {
          lang1Specific = /@Override|@Deprecated|@SuppressWarnings|\.java$|System\.(out|err)\.(print|println)|import\s+java\.|package\s+[a-z]|public\s+static\s+void\s+main\s*\(\s*String\[\]\s*\w+\s*\)|String\s+\w+\s*=|System\.(out|err)\.(print|println)|throws\s+\w+Exception|new\s+\w+Exception\(|Exception\s+\w+\s*=|final\s+(class|void|int|String|boolean|double|float|long|short|byte|char)|implements\s+\w+|throws\s+\w+Exception/;
          lang2Specific = /<\?php|<\?=|\$[a-zA-Z_][a-zA-Z0-9_]+\s*=|\becho\b|\bprint\b|\bprint_r\b|\bvar_dump\b|\bfunction\s+\w+\s*\(|\bclass\s+\w+|\bpublic\s+function|\bprivate\s+function|\bprotected\s+function|->\w+|::\w+|\bnamespace\s+|\buse\s+.*\\|\brequire(_once)?\s*[\("']|\binclude(_once)?\s*[\("'](?![<"])|\$this->|\bnew\s+\w+\s*\(|\bextends\s+\w+|\bimplements\s+\w+|\barray\s*\(|\b(foreach|endif|endwhile|endfor|elseif)\b|=>|\?>|\$\w+\[|\$\w+\s*\.\=|\$\w+\+\+|\$\w+\-\-|\$\w+\s*\+\=|\$\w+\s*\-\=|\bisset\(|empty\(|unset\(|mysql_|mysqli_|PDO|\$_(GET|POST|SESSION|COOKIE|SERVER|REQUEST|FILES)|define\(|defined\(|__FILE__|__LINE__|__DIR__|__FUNCTION__|__CLASS__|__TRAIT__|__METHOD__|__NAMESPACE__/;
        } else if (pair.lang1 === 'csharp' && pair.lang2 === 'php') {
          lang1Specific = /#region|#endregion|@\w+\s+=[^=]|\.cs$|\.csproj$|\.NET\s+Core|\.NET\s+Framework|Console\.(Write|WriteLine)|Debug\.(Write|WriteLine)|using\s+System|struct\s+\w+\s*{|;\s*\/\/|\/\*[\s\S]*?\*\/|public\s+class|internal\s+class|namespace\s+[A-Z]\w+|string\s+\w+\s*=|var\s+\w+\s*=|\.cs$|\.csproj$|List<string>|Dictionary<string,|async\s+(Task|void)\s+\w+\s*\(|override\s+|:\s*\w+\s*\{|int\s+\w+\s*=|bool\s+\w+\s*=|double\s+\w+\s*=|float\s+\w+\s*=|char\s+\w+\s*=|decimal\s+\w+\s*=|long\s+\w+\s*=|short\s+\w+\s*=|byte\s+\w+\s*=|uint\s+\w+\s*=|ulong\s+\w+\s*=|ushort\s+\w+\s*=|sbyte\s+\w+\s*=|enum\s+\w+|interface\s+\w+|abstract\s+class|sealed\s+class|static\s+class|readonly\s+\w+|const\s+\w+\s*=|ref\s+\w+|out\s+\w+|in\s+\w+|params\s+\w+|base\.|this\.|new\s+\w+\(|base\(|typeof\s*\(|sizeof\s*\(|nameof\s*\(|default\s*\(|checked\s*\{|unchecked\s*\{|lock\s*\(|using\s*\(|fixed\s*\(|stackalloc\s*|unsafe\s*|fixed\s*|volatile\s+|event\s+|delegate\s+|operator\s+|implicit\s+|explicit\s+|get\s*{|set\s*{|add\s*{|remove\s*{|value\s*=|yield\s+return|yield\s+break|partial\s+class|partial\s+struct|partial\s+interface|where\s+\w+\s*:|new\s*\(\)|\.ctor\s*\(|\.cctor\s*\(|\[\w+\]\s*\{|\]\s*\{|\]\s*:\s*\w+/;
          lang2Specific = /<\?php|<\?=|\$[a-zA-Z_][a-zA-Z0-9_]+\s*=|\becho\b|\bprint\b|\bprint_r\b|\bvar_dump\b|\bfunction\s+\w+\s*\(|\bclass\s+\w+|\bpublic\s+function|\bprivate\s+function|\bprotected\s+function|->\w+|::\w+|\bnamespace\s+|\buse\s+.*\\|\brequire(_once)?\s*[\("']|\binclude(_once)?\s*[\("'](?![<"])|\$this->|\bnew\s+\w+\s*\(|\bextends\s+\w+|\bimplements\s+\w+|\barray\s*\(|\b(foreach|endif|endwhile|endfor|elseif)\b|=>|\?>|\$\w+\[|\$\w+\s*\.\=|\$\w+\+\+|\$\w+\-\-|\$\w+\s*\+\=|\$\w+\s*\-\=|\bisset\(|empty\(|unset\(|mysql_|mysqli_|PDO|\$_(GET|POST|SESSION|COOKIE|SERVER|REQUEST|FILES)|define\(|defined\(|__FILE__|__LINE__|__DIR__|__FUNCTION__|__CLASS__|__TRAIT__|__METHOD__|__NAMESPACE__|\$this->|\$\w+\[|\$_[A-Z]+|echo\s+|print\s+|\barray\s*\(|\bforeach\s*\(|\bendif\b|\bendwhile\b|\bendfor\b|\belseif\b|=>|\?>|<\?php|<\?=/;
        } else if (pair.lang1 === 'javascript' && pair.lang2 === 'csharp') {
          lang1Specific = /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|\s*=>\s*[{(]|\bconsole\.(log|error|warn)|\basync\s+function|\bawait\s+|document\.|window\.|\$\(|require\(|module\.exports|\.prototype\.|undefined|null|NaN|Infinity|\b(function|var|let|const|if|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw)\b.*\{|\.js$|typeof\s+\w+|instanceof\s+\w+|\.addEventListener\(|fetch\(|Promise\.|\.then\(|\.catch\(/;
          lang2Specific = /#region|#endregion|@\w+\s+=[^=]|\.cs$|\.csproj$|\.NET\s+Core|\.NET\s+Framework|Console\.(Write|WriteLine)|Debug\.(Write|WriteLine)|using\s+System|struct\s+\w+\s*{|;\s*\/\/|\/\*[\s\S]*?\*\/|public\s+class|internal\s+class|namespace\s+[A-Z]\w+|string\s+\w+\s*=|var\s+\w+\s*=|\.cs$|\.csproj$|List<string>|Dictionary<string,|async\s+(Task|void)\s+\w+\s*\(|override\s+|:\s*\w+\s*\{/;
        } else if (pair.lang1 === 'javascript' && pair.lang2 === 'ruby') {
          // Specific patterns for JavaScript vs Ruby conflict resolution
          lang1Specific = /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|\s*=>\s*[{(]|\bconsole\.(log|error|warn)|\basync\s+function|\bawait\s+|document\.|window\.|\$\(|require\(|module\.exports|\.prototype\.|undefined|null|NaN|Infinity|\b(function|var|let|const|if|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw)\b.*\{|\.js$|typeof\s+\w+|instanceof\s+\w+|\.addEventListener\(|fetch\(|Promise\.|\.then\(|\.catch\(|{|}|\[|\]/;
          lang2Specific = /\bdef\s+\w+\s*$|\bend\b|\bclass\s+\w+\s*$|\bmodule\s+\w+\s*$|require\s+['"][^'"]+['"]|\bputs\b|attr_accessor\s+:\w+|attr_reader\s+:\w+|attr_writer\s+:\w+|\bdo\s*\|\w+(,\s*\w+)*\|\s*$|\.rb$|#!.*ruby|\bbegin\b|\brescue\b|\bensure\b|\braise\b|:\w+\s*=>\s*|@\w+\s*=|\b(instance_variable_get|instance_variable_set|define_method)\b|\$(?!jQuery)(?:[a-zA-Z_][a-zA-Z0-9_]*)?\s*=|\b(yield\s+\w*|block_given\?)\b|\.new\s*\(|\bmodule\b.*\bend\b|\bclass\b.*\bend\b/;
        } else if (pair.lang1 === 'javascript' && pair.lang2 === 'php') {
          // Specific patterns for JavaScript vs PHP conflict resolution
          lang1Specific = /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|\s*=>\s*[{(]|\bconsole\.(log|error|warn)|\basync\s+function|\bawait\s+|document\.|window\.|\$\(|require\(|module\.exports|\.prototype\.|undefined|null|NaN|Infinity|\b(function|var|let|const|if|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw)\b.*\{|\.js$|typeof\s+\w+|instanceof\s+\w+|\.addEventListener\(|fetch\(|Promise\.|\.then\(|\.catch\(|{|}|\[|\]/;
          lang2Specific = /<\?php|<\?=|\$[a-zA-Z_][a-zA-Z0-9_]+\s*=|\becho\b|\bprint\b|\bprint_r\b|\bvar_dump\b|\bfunction\s+\w+\s*\(|\bclass\s+\w+|\bpublic\s+function|\bprivate\s+function|\bprotected\s+function|->\w+|::\w+|\bnamespace\s+|\buse\s+.*\\|\brequire(_once)?\s*[\("']|\binclude(_once)?\s*[\("'](?![<"])|\$this->|\bnew\s+\w+\s*\(|\bextends\s+\w+|\bimplements\s+\w+|\barray\s*\(|\b(foreach|endif|endwhile|endfor|elseif)\b|=>|\?>|\$\w+\[|\$\w+\s*\.\=|\$\w+\+\+|\$\w+\-\-|\$\w+\s*\+\=|\$\w+\s*\-\=|\bisset\(|empty\(|unset\(|mysql_|mysqli_|PDO|\$_(GET|POST|SESSION|COOKIE|SERVER|REQUEST|FILES)|define\(|defined\(|__FILE__|__LINE__|__DIR__|__FUNCTION__|__CLASS__|__TRAIT__|__METHOD__|__NAMESPACE__/;
        }
        
        const lang1Matches = (text.match(lang1Specific) || []).length;
        const lang2Matches = (text.match(lang2Specific) || []).length;
        
        // Удаляем оба совпадения
        const filteredMatches = matches.filter(m => m.lang !== pair.lang1 && m.lang !== pair.lang2);
        
        // Добавляем язык с большим количеством специфичных совпадений
        if (lang1Matches > lang2Matches) {
          filteredMatches.push({ lang: pair.lang1, weight: pair.weight1 });
        } else if (lang2Matches > lang1Matches) {
          filteredMatches.push({ lang: pair.lang2, weight: pair.weight2 });
        } else {
          // Если совпадений поровну, используем веса для определения языка
          if (pair.weight1 > pair.weight2) {
            filteredMatches.push({ lang: pair.lang1, weight: pair.weight1 });
          } else if (pair.weight2 > pair.weight1) {
            filteredMatches.push({ lang: pair.lang2, weight: pair.weight2 });
          } else {
            // Если веса равны, оставляем оба с оригинальным весом
            filteredMatches.push(...matches.filter(m => m.lang === pair.lang1 || m.lang === pair.lang2));
          }
        }
        
        matches.splice(0, matches.length, ...filteredMatches);
      }
    }

    // Если есть совпадения, выбираем с максимальным весом
    if (matches.length > 0) {
      matches.sort((a, b) => b.weight - a.weight);
      // Преобразуем название языка в правильный формат (с заглавной буквы)
      const languageName = matches[0].lang.charAt(0).toUpperCase() + matches[0].lang.slice(1);
      return { isCode: true, language: languageName };
    }

    // Если есть признаки кода, но язык не определен
    const hasCodeCharacteristics = (
      (text.includes('{') && text.includes('}')) ||
      (text.includes('(') && text.includes(')')) ||
      text.match(/^\s{2,}/m) || // Множественные отступы
      (text.split('\n').length > 3 && (text.includes('=') || text.includes(':')))
    );
    
    if (hasCodeCharacteristics && text.length > 50) {
      return { isCode: true, language: 'CODE' };
    }

    return { isCode: false, language: null };
  }

  detectCode(text) {
    // Проверяем, есть ли признаки кода в тексте
    const hasCodeCharacteristics = (
      (text.includes('{') && text.includes('}')) ||
      text.match(/^\s{2,}/m) || // Множественные отступы
      (text.split('\n').length > 3 && (text.includes('=') || text.includes(':'))) ||
      text.includes('import ') || // Python import statements
      text.includes('def ') || // Python function definitions
      text.includes('class ') || // Class definitions
      text.includes('function ') || // JS functions
      text.includes('const ') || text.includes('let ') || text.includes('var ') // JS variables
    );
    
    // Если нет явных признаков кода, проверяем URL
    if (!hasCodeCharacteristics) {
      const urlDetection = this.detectURL(text);
      if (urlDetection.isURL) {
        return { isCode: false };
      }
      return { isCode: false };
    }

    // Если LinguistDetector доступен, используем его (закомментировано для исправления определения Python)
    // if (this.linguistDetector) {
    //   try {
    //     const detectedLanguage = this.linguistDetector.detect('sample.txt', text);
    //     if (detectedLanguage) {
    //       return { isCode: true, language: detectedLanguage };
    //     }
    //   } catch (e) {
    //     console.warn('LinguistDetector error:', e);
    //   }
    // }
    
    // Резервный метод определения кода с определением языка
    // Проверяем специфичные паттерны для разных языков
    const patterns = {
      'JavaScript': [
        /\b(function|const|let|var|if|for|while|switch|case|break|return|export|as|async|await)\b/,
        /console\.(log|error|warn|info)/,
        /=>\s*{/,  // Arrow functions with braces
        /\b(true|false|null|undefined)\b/,
        /\.prototype\./,
        /document\.|window\.|\$\(/,
        /typeof\s+\w+/,
        /instanceof\s+\w+/,
        /\.addEventListener\(/,
        /fetch\(|Promise\.|\.then\(|\.catch\(/,
        /;\s*\/\/.*$/,  // JavaScript-style line comments
        /\/\*[\s\S]*?\*\//,  // JavaScript-style block comments
        /\b(function\s+\w+\s*\(.*\)\s*{)/,  // Function declarations with braces
        /\b(class\s+\w+\s*{)/,  // ES6 class declarations
        /\.js$/,  // JavaScript file extension
        /\b(module\.exports|exports\.|require\()\b/,  // Node.js specific
        /\b(document|window|navigator|location|history)\./,  // Browser objects
        /\b(try\s*{.*}\s*catch\s*\(.*\)\s*{.*})\b/  // Try-catch blocks
      ],
      'TypeScript': [
        /\b(function|const|let|var|if|for|while|switch|case|break|return|import|export|from|as|async|await)\b/,
        /console\.(log|error|warn|info)/,
        /=>\s*{/,  // Arrow functions with braces
        /\b(true|false|null|undefined)\b/,
        /\.prototype\./,
        /document\.|window\.|\$\(/,
        /typeof\s+\w+/,
        /instanceof\s+\w+/,
        /\.addEventListener\(/,
        /fetch\(|Promise\.|\.then\(|\.catch\(/,
        /;\s*\/\/.*$/,  // JavaScript-style line comments
        /\/\*[\s\S]*?\*\//,  // JavaScript-style block comments
        /\b(var|let|const)\s+\w+\s*=\s*\w+;/,  // Variable declarations with semicolons
        /\b(function\s+\w+\s*\(.*\)\s*{)/,  // Function declarations with braces
        /\b(class\s+\w+\s*{)/,  // ES6 class declarations
        /\.ts$/,  // TypeScript file extension
        /:\s*(string|number|boolean|void|any|unknown|never|undefined|null|symbol|bigint|object|Function|Array|Promise|Map|Set)\b/,  // Type annotations
        /\b(interface\s+\w+)/,  // Interface declarations
        /\b(type\s+\w+\s*=)/,  // Type aliases
        /\b(readonly\s+\w+)/,  // Readonly modifier
        /\b(generics<\w+>)/,  // Generics
        /\b(declare\s+)/  // Declaration keyword
      ],
      'Python': [
        /\b(def\s+\w+\s*\(.*\):|class\s+\w+\s*[:,])/,
        /print\s*\(/,
        /:\s*$/,
        /\b(True|False|None)\b/,
        /__name__\s*==\s*['"]__main__['"]/,
        /\b(self\.)\b/,
        /@\w+/,
        /\b(lambda\s+.*:|yield\s+|with\s+|global\s+\w+|nonlocal\s+\w+)\b/,
        /\b(elif\s+.*:|else:|try:|except\s+.*:|finally:|for\s+\w+\s+in\s+.*:|while\s+.*:|import\s+\w+|from\s+\w+\s+import\s+\w+)\b/,
        /\[.*\s+for\s+\w+\s+in\s+.*\]/,  // List comprehensions
        /\b(len\(|range\(|enumerate\(|zip\(|map\(|filter\(|random\(|os\.)/,  // Common Python functions and modules
        /\b(import\s+random|import\s+os)\b/,  // Python import statements
        /\s*:\s*#/,  // Python comments
        /\b(if\s+.*:|elif\s+.*:|else:)/  // Python conditionals
      ],
      'Java': [
        /\b(public|private|protected|class|interface|extends|implements|import|package|static|final|void|int|String|boolean|double|float|long|short|byte|char)\b/,
        /\b(System\.out\.print|System\.err\.print)\b/,
        /new\s+\w+\s*\(/,
        /@Override|@Deprecated|@SuppressWarnings/,
        /throws\s+\w+Exception/,
        /\.java$/,
        /final\s+(class|void|int|String|boolean|double|float|long|short|byte|char)/,
        /public\s+static\s+void\s+main\s*\(\s*String\[\s*\]\s*\w+\s*\)/,  // Main method
        /System\.(out|err)\.(println|print)/  // System output
      ],
      'C#': [
        /\b(public|private|protected|class|interface|namespace|using|static|readonly|const|void|int|string|bool|double|float|long|short|byte|char|enum)\b/,
        /Console\.(Write|WriteLine)/,
        /new\s+\w+\s*\(/,
        /#region|#endregion/,
        /async\s+|await\s+/,  // Async/await keywords
        /\.cs$/,
        /List<\w+>|Dictionary<\w+,/,
        /\b(string\[\s*\]\s*\w+|int\[\s*\]\s*\w+)\b/,  // Array declarations
        /\b(var\s+\w+\s*=\s*new\s+)/,  // Var keyword with new
        /\.NET\s+(Framework|Core)/  // .NET references
      ],
      'PHP': [
        /<\?php|<\?=|\?>/,  // PHP opening and closing tags
        /\$[a-zA-Z_][a-zA-Z0-9_]+\s*=|\$[a-zA-Z_][a-zA-Z0-9_]+\[.*\]\s*=|\$\w+\[.*\]/,  // PHP variable assignments with array access
        /\becho\s+|\bprint\s+|\bprint_r\s*\(|\bvar_dump\s*\(/,  // PHP output functions with proper spacing
        /\bfunction\s+\w+\s*\(.*\)\s*\{/,  // PHP function declarations
        /\bclass\s+\w+\s*(extends|implements)?\s*\w*\s*\{/,  // PHP class declarations with inheritance
        /\b(public|private|protected)\s+function/,  // PHP method visibility
        /\$this->|\bthis->/,  // $this variable
        /->\w+\s*\(|->\w+\s*=|::\w+/,  // Object operators
        /\bnamespace\s+[A-Za-z0-9_\\]+;/,  // Namespace declarations with semicolon
        /\buse\s+[A-Za-z0-9_\\]+;/,  // Use statements with semicolon
        /\brequire(_once)?\s*[\("']|\binclude(_once)?\s*[\("']/,  // Include/require statements
        /\bnew\s+\w+\s*\(.*\)/,  // Object instantiation with parentheses
        /\bextends\s+\w+|\bimplements\s+\w+/,  // Inheritance
        /\barray\s*\(.*\)|\[.*\]/,  // Array syntax
        /\b(foreach|endif|endwhile|endfor|elseif|endforeach)\b/,  // PHP control structures
        /=>/,  // Array key-value separator
        /\$\w+\[|\$\w+\s*\.\=|\$\w+\+\+|\$\w+\-\-|\$\w+\s*\+\=|\$\w+\s*\-\=/,  // PHP-specific operators
        /\bisset\s*\(|empty\s*\(|unset\s*\(|mysql_|mysqli_|PDO/,  // PHP functions
        /\$_(GET|POST|SESSION|COOKIE|SERVER|REQUEST|FILES)\b|define\s*\(|defined\s*\(|__FILE__|__LINE__|__DIR__|__FUNCTION__|__CLASS__|__TRAIT__|__METHOD__|__NAMESPACE__/  // PHP superglobals and constants
      ],
      'HTML': [
        /<html/i,
        /<\/html>/i,
        /<div/i,
        /<\/div>/i,
        /<!DOCTYPE html>/i
      ],
      'CSS': [
        /[a-zA-Z0-9\-_]+\s*{/,
        /:\s*[a-zA-Z0-9\-_#().]+;/,
        /@media|@import|@keyframes/
      ],
      'SQL': [
        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|ON|AS|TABLE|CREATE|DROP|ALTER|DISTINCT|HAVING|GROUP|ORDER|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\b/i,
        /';'/,  // SQL statement terminator
        /--.*$/,  // SQL line comment
        /\/\*[\s\S]*?\*\//,  // SQL block comment
        /\b(AND|OR|NOT|BETWEEN|IN|LIKE|IS\s+NULL|IS\s+NOT\s+NULL)\b/i,  // SQL operators
        /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(.*\)/i,  // Aggregate functions
        /\b(ASC|DESC)\b/i,  // Sorting keywords
        /\b(PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES|CONSTRAINT)\b/i,  // Constraint keywords
        /\b(VARCHAR|CHAR|INT|INTEGER|FLOAT|DOUBLE|DATE|TIMESTAMP|BOOLEAN)\b/i,  // Data types
        /\b(USE|DATABASE|SHOW\s+TABLES|DESCRIBE)\b/i  // Database management keywords
      ],
      'Bash': [
        /#!\/(bin\/bash|usr\/bin\/env\s+bash)/,  // Shebang
        /\b(echo|printf|read|export|unset|let|declare|typeset)\b/,  // Bash commands
        /\$\w+|\$\{\w+\}/,  // Variable references
        /\$\(.*\)|\`.*\`/,  // Command substitution
        /\b(if|then|else|elif|fi|for|while|until|do|done|case|esac)\b/,  // Control structures
        /\|\||&&|;/,  // Operators
        /\[\s+.*\s+\]|\[\[\s+.*\s+\]\]/,  // Test conditions
        /\b(function\s+\w+\s*\(\s*\)\s*\{)/  // Function declarations
      ],
      'Ruby': [
        /\bdef\s+\w+\s*$|\bdef\s+\w+\s*\|/,  // Function definition with optional parameters
        /\bend\b/,
        /\bclass\s+\w+\s*$/,
        /\bmodule\s+\w+\s*$/,
        /require\s+['"][^'"]+['"]|require_relative\s+['"][^'"]+['"]/,  // Require statements
        /\bputs\b/,
        /attr_accessor\s+:\w+/,
        /attr_reader\s+:\w+/,
        /attr_writer\s+:\w+/,
        /\bdo\s*\|\w+(,\s*\w+)*\|\s*$/,  // More specific block syntax
        /\.rb$/,
        /#!.*ruby/,
        /\bbegin\b/,
        /\brescue\b/,
        /\bensure\b/,
        /\braise\b/,
        /:\w+\s*=>\s*\w+|:\w+\s*=>\s*\{/,  // More specific hash syntax
        /@\w+\s*=\s*\w+|@\w+\s*=\s*".*"|@\w+\s*=\s*'.*'/,  // More specific instance variable assignments
        /\$\w+\s*=\s*\w+/,  // Global variables
        /\bmodule\b.*\bend\b/,  // Module blocks
        /\bclass\b.*\bend\b/,  // Class blocks
        /\|\w+\s*\|\s*->/,  // Block parameter syntax
        /\b(yield\s+\w*|block_given\?)\b/,  // Block-related keywords
        /\b(self\.)\w+/,  // Method calls on self
        /\b(include|extend)\s+\w+/,  // Module inclusion
        /\b(has_many|has_one|belongs_to)\s+:\w+/,  // Rails associations
        /#\s*.*$/  // Ruby-style comments
      ],
      'Go': [
        /\b(package|import|func|var|const|type|struct|interface|map|chan)\b/,
        /fmt\./
      ],
      'Rust': [
        /\b(fn\s+main\s*\(\)|fn\s+\w+\s*\(.*\)\s*->\s*\w+)/,  // Function declarations with return types
        /\b(let\s+mut\s+\w+|let\s+\w+)/,  // Variable declarations
        /\b(println!|print!|panic!|assert!)/,  // Macros
        /\b(struct\s+\w+|enum\s+\w+|impl\s+\w+)/,  // Struct, enum, impl
        /\b(pub\s+fn|pub\s+struct|pub\s+enum)/,  // Public visibility
        /\b(use\s+std|use\s+crate)/,  // Use statements
        /\b(match\s+\w+\s*{)/,  // Match expressions
        /\b(if\s+let\s+\w+)/,  // If let expressions
        /\.rs$/,  // Rust file extension
        /\/\/.*$/,  // Line comments
        /\/\*[\s\S]*?\*\//  // Block comments
      ],
      'C++': [
          /#include\s*<[^>]+>|#include\s*"[^"]+"/,  // Include directives
          /\b(std::|cout|cin|namespace)\b/,
          /\b(using\s+namespace\s+\w+;)\b/,  // Using namespace
          /\b(int|void|bool|char|float|double|long|short)\s+main\s*\(.*\)/,  // Main function
          /\bvoid\s+setup\s*\(\s*\)/,  // Arduino setup function
          /\bvoid\s+loop\s*\(\s*\)/,  // Arduino loop function
          /\b(class|struct)\s+\w+\s*\{/,  // Class/struct definitions
          /\b(public|private|protected):/,  // Access specifiers
          /\b(std::cout|std::cin|std::endl)/,  // Standard library objects
          /\.cpp$|\.ino$/,  // C++ file extensions
          /\b(int|void|bool|char|float|double|long|short)\s+\w+\s*\(.*\)\s*\{/,  // Function definitions
          /\b\w+\s+\w+\s*\(/  // Variable declarations or function calls
      ],
      'Swift': [
        /\b(func\s+\w+\s*\(.*\)\s*->\s*\w+|func\s+\w+\s*\(.*\))/,  // Function declarations
        /\b(let\s+\w+|var\s+\w+)/,  // Variable declarations
        /\b(struct\s+\w+|class\s+\w+|enum\s+\w+)/,  // Struct, class, enum
        /\b(import\s+\w+)/,  // Import statements
        /\b(if\s+let\s+\w+|guard\s+let\s+\w+)/,  // Optional binding
        /\b(println\(|print\()/,  // Print functions
        /\.swift$/,  // Swift file extension
        /\/\/.*$/,  // Line comments
        /\/\*[\s\S]*?\*\//  // Block comments
      ],
      'Kotlin': [
        /\b(fun\s+main\s*\(.*\)|fun\s+\w+\s*\(.*\):\s*\w+)/,  // Function declarations
        /\b(val\s+\w+|var\s+\w+)/,  // Variable declarations
        /\b(class\s+\w+|interface\s+\w+|object\s+\w+)/,  // Class, interface, object
        /\b(import\s+kotlin|import\s+java)/,  // Import statements
        /\b(println\(|print\()/,  // Print functions
        /\.kt$/,  // Kotlin file extension
        /\/\/.*$/,  // Line comments
        /\/\*[\s\S]*?\*\//  // Block comments
      ]
    };
    
    // Define conflict pairs with weights
    const conflictPairs = [
      { lang1: 'csharp', lang2: 'java', weight1: 6, weight2: 5 },
      { lang1: 'csharp', lang2: 'ruby', weight1: 6, weight2: 5 },
      { lang1: 'java', lang2: 'ruby', weight1: 5, weight2: 6 },
      { lang1: 'python', lang2: 'ruby', weight1: 5, weight2: 6 },
      { lang1: 'php', lang2: 'ruby', weight1: 5, weight2: 6 },
      { lang1: 'java', lang2: 'php', weight1: 6, weight2: 5 },  // Java has higher weight
      { lang1: 'csharp', lang2: 'php', weight1: 6, weight2: 5 },  // C# has higher weight
      { lang1: 'javascript', lang2: 'csharp', weight1: 5, weight2: 6 },  // C# has higher weight
      { lang1: 'javascript', lang2: 'ruby', weight1: 5, weight2: 6 },  // Ruby has higher weight
      { lang1: 'javascript', lang2: 'php', weight1: 5, weight2: 6 },  // PHP has higher weight
      { lang1: 'javascript', lang2: 'typescript', weight1: 5, weight2: 6 },  // TypeScript has higher weight
      { lang1: 'php', lang2: 'typescript', weight1: 5, weight2: 6 },  // TypeScript has higher weight
      { lang1: 'java', lang2: 'c++', weight1: 6, weight2: 5 },  // Java has higher weight
      { lang1: 'c++', lang2: 'csharp', weight1: 5, weight2: 6 },  // C# has higher weight
      { lang1: 'bash', lang2: 'javascript', weight1: 6, weight2: 5 },  // Bash has higher weight
      { lang1: 'rust', lang2: 'bash', weight1: 6, weight2: 5 },  // Rust has higher weight
      { lang1: 'swift', lang2: 'python', weight1: 6, weight2: 5 },  // Swift has higher weight
      { lang1: 'kotlin', lang2: 'python', weight1: 6, weight2: 5 },  // Kotlin has higher weight
      { lang1: 'sql', lang2: 'python', weight1: 6, weight2: 5 },  // SQL has higher weight than Python
      { lang1: 'python', lang2: 'javascript', weight1: 6, weight2: 5 }  // Python has higher weight than JavaScript
    ];
    
    // Collect matches with weights
    let matches = [];
    
    for (const [language, langPatterns] of Object.entries(patterns)) {
      const langMatches = langPatterns.filter(pattern => pattern.test(text)).length;
      // Assign weights based on number of matches
      if (langMatches >= 2) {
        matches.push({ lang: language, weight: langMatches * 2 }); // Higher weight for multiple matches
      } else if (langMatches >= 1) {
        matches.push({ lang: language, weight: langMatches }); // Base weight for single match
      }
    }
    
    // Resolve conflicts if there are multiple matches
    if (matches.length > 1) {
      return this.resolveConflicts(matches, conflictPairs, text);
    }
    
    // If there's only one match, return it
    if (matches.length === 1) {
      // Преобразуем название языка в правильный формат (с заглавной буквы)
      const languageName = matches[0].lang.charAt(0).toUpperCase() + matches[0].lang.slice(1);
      return { isCode: true, language: languageName };
    }
    
    // Общий резервный метод - проверяем базовые признаки кода
    // Сначала проверяем, не является ли текст URL
    const urlDetection = this.detectURL(text);
    if (urlDetection.isURL) {
      return { isCode: false };
    }

    return { isCode: false, language: null };
  }

  detectFile(text) {
    // Паттерны для определения файлов в сообщении
    // Ищем только URL файлов или base64 данные (реальные вложения)
    const urlPattern = /(https?:\/\/[^\s]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|txt|csv|json|xml|jpg|jpeg|png|gif|svg|webp|mp4|avi|mov|mp3|wav|ogg|stl|usdz))/i;
    const base64Pattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([A-Za-z0-9+/=]{20,})/;
    
    // Проверяем base64 (высокий приоритет - это реальный файл)
    const base64Match = text.match(base64Pattern);
    if (base64Match) {
      const mimeType = base64Match[1];
      const extension = this.getExtensionFromMime(mimeType);
      const filename = `file.${extension.toLowerCase()}`;
      return { isFile: true, filename, extension, base64: text };
    }
    
    // Проверяем URL файла
    const urlMatch = text.match(urlPattern);
    if (urlMatch) {
      const filename = urlMatch[1].split('/').pop();
      const extension = filename.split('.').pop().toUpperCase();
      return { isFile: true, filename, extension, url: urlMatch[1] };
    }
    
    // Если не найдено URL или base64 - это не файл
    return { isFile: false };
  }

  detectURL(text) {
    // Паттерн для определения URL ссылок, включая возможные кавычки
    const urlPattern = /(?:(?:"|')(https?:\/\/[^\s"'>]+)(?:"|')|(https?:\/\/[^\s"'>]+))/gi;
    
    // Проверяем, есть ли в сообщении URL
    const matches = text.match(urlPattern);
    
    // Если URL не найдены, возвращаем false
    if (!matches) return { isURL: false };
    
    // Извлекаем чистые URL без кавычек
    const cleanUrls = matches.map(match => {
      const quotedMatch = match.match(/^("|')(https?:\/\/[^\s"'>]+)("|')$/);
      if (quotedMatch) {
        return quotedMatch[2]; // Возвращаем URL без кавычек
      }
      return match; // Уже чистый URL
    }).filter(url => {
      // Фильтруем URL, которые выглядят как часть кода
      // Проверяем, что URL не окружены символами кода
      const urlIndex = text.indexOf(url);
      if (urlIndex > 0) {
        const beforeChar = text[urlIndex - 1];
        // Если перед URL есть символы кода, это может быть часть кода
        if (/[\w\.=]/.test(beforeChar)) {
          // Проверяем контекст более тщательно
          const context = text.substring(Math.max(0, urlIndex - 10), urlIndex + url.length + 10);
          // Если контекст выглядит как код, пропускаем этот URL
          if (/\b(function|const|let|var|class|public|private|protected)\b/.test(context) ||
              /\b(import|require|include)\b/.test(context) ||
              /[{}();]/.test(context)) {
            return false;
          }
        }
      }
      return true;
    });
    
    // Если после фильтрации URL не осталось, возвращаем false
    if (cleanUrls.length === 0) return { isURL: false };
    
    // Если в сообщении одна URL, возвращаем её для кнопки "Перейти"
    if (cleanUrls.length === 1) {
      return { isURL: true, url: cleanUrls[0], multiple: false };
    }
    
    // Если в сообщении несколько URL, возвращаем их все для кнопки "Скопировать"
    return { isURL: true, urls: cleanUrls, multiple: true };
  }

  getExtensionFromMime(mimeType) {
    const mimeMap = {
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/zip': 'ZIP',
      'text/plain': 'TXT',
      'text/csv': 'CSV',
      'application/json': 'JSON',
      'image/jpeg': 'JPG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/svg+xml': 'SVG',
      'image/webp': 'WEBP',
      'video/mp4': 'MP4',
      'audio/mpeg': 'MP3',
      'model/stl': 'STL',
      'application/octet-stream': 'STL',
      'model/vnd.usdz+zip': 'USDZ',
      'model/usd': 'USDZ'
    };
    return mimeMap[mimeType] || 'FILE';
  }

  downloadFile(button, text, filename) {
    // Определяем тип данных и скачиваем файл
    const fileDetection = this.detectFile(text);
    
    try {
      let blob;
      let downloadUrl;
      
      if (fileDetection.url) {
        // Если это URL, открываем в новой вкладке
        window.open(fileDetection.url, '_blank');
        this.showDownloadSuccess(button);
        return;
      }
      
      if (fileDetection.base64) {
        // Если это base64, конвертируем в blob
        const base64Match = text.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([A-Za-z0-9+/=]+)/);
        if (base64Match) {
          const mimeType = base64Match[1];
          const base64Data = base64Match[2];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: mimeType });
          downloadUrl = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          
          this.showDownloadSuccess(button);
        }
      } else {
        // Если это просто текст, сохраняем как текстовый файл
        blob = new Blob([text], { type: 'text/plain' });
        downloadUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        this.showDownloadSuccess(button);
      }
    } catch (err) {
      console.error('Ошибка скачивания:', err);
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Ошибка
      `;
    }
  }

  showDownloadSuccess(button) {
    const originalContent = button.innerHTML;
    button.classList.add('downloaded');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Скачано
    `;
    
    setTimeout(() => {
      button.classList.remove('downloaded');
      button.innerHTML = originalContent;
    }, 2000);
  }

  downloadFileFromBase64(button, base64Data, filename) {
    try {
      // Извлекаем MIME тип и данные из base64
      const base64Match = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([A-Za-z0-9+/=]+)/);
      
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64String = base64Match[2];
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        this.showDownloadSuccess(button);
      }
    } catch (err) {
      console.error('Ошибка скачивания:', err);
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Ошибка
      `;
    }
  }

  copyCode(button, text) {
    if (button.classList.contains('message-forward-btn')) {
      // Для кнопки пересылки - показать попап
      this.showForwardPopup(text);
      // Выделить кнопку голубым
      button.classList.add('forwarded');
      setTimeout(() => {
        button.classList.remove('forwarded');
      }, 2000);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      if (button.classList.contains('message-copy-btn')) {
        // Для кнопки копирования сообщения - только изменение цвета иконки
        button.classList.add('copied');
        setTimeout(() => {
          button.classList.remove('copied');
        }, 2000);
      } else {
        // Для кнопок копирования кода - изменение текста и иконки
        const originalContent = button.innerHTML;
        button.classList.add('copied');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Скопировано
        `;

        setTimeout(() => {
          button.classList.remove('copied');
          button.innerHTML = originalContent;
        }, 2000);
      }
    }).catch(err => {
      console.error('Ошибка копирования:', err);
    });
  }

  copyFileToClipboard(button, base64Data, filename) {
    console.log('copyFileToClipboard called with filename:', filename, 'base64Data length:', base64Data.length);
    try {
      // Извлекаем MIME тип и base64 данные
      const base64Match = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([A-Za-z0-9+/=]+)/);
      if (!base64Match) {
        throw new Error('Неверный формат base64 данных');
      }

      const mimeType = base64Match[1];
      const base64String = base64Match[2];
      console.log('MIME type:', mimeType, 'base64 string length:', base64String.length);

      // Для изображений сначала пробуем с оригинальным форматом
      if (mimeType.startsWith('image/')) {
        console.log('Trying to copy image with original format:', mimeType);
        console.log('ClipboardItem available:', typeof ClipboardItem);
        console.log('ClipboardItem.supports available:', typeof ClipboardItem !== 'undefined' && ClipboardItem.supports);
        // Конвертируем base64 в Uint8Array
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        this.copyBlobToClipboard(button, blob, mimeType, base64Data).catch((err) => {
          console.log('Original format failed:', err.message, 'converting to PNG');
          // Если не удалось, конвертируем в PNG
          this.convertImageToPngBlob(base64Data).then(pngBlob => {
            console.log('PNG blob created, size:', pngBlob.size);
            this.copyBlobToClipboard(button, pngBlob, 'image/png', base64Data);
          }).catch(err => {
            console.error('Error converting image:', err);
            // Показать ошибку
            const originalContent = button.innerHTML;
            button.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            `;
            setTimeout(() => {
              button.innerHTML = originalContent;
            }, 2000);
          });
        });
        return;
      }

      // Для не-изображений используем оригинальный MIME тип
      // Конвертируем base64 в Uint8Array
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      console.log('Byte array length:', byteArray.length);

      // Создаем Blob с правильным MIME типом
      const blob = new Blob([byteArray], { type: mimeType });
      console.log('Blob created with type:', blob.type, 'size:', blob.size);

      this.copyBlobToClipboard(button, blob, mimeType, base64Data).catch(err => {
        console.error('Failed to copy file:', err);
        // Показать ошибку
        const originalContent = button.innerHTML;
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        `;
        setTimeout(() => {
          button.innerHTML = originalContent;
        }, 2000);
      });
    } catch (err) {
      console.error('Ошибка обработки файла:', err);
      // Показать ошибку
      const originalContent = button.innerHTML;
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
      setTimeout(() => {
        button.innerHTML = originalContent;
      }, 2000);
    }
  }

  convertImageToPngBlob(base64Data) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(resolve, 'image/png');
      };
      img.onerror = reject;
      img.src = base64Data;
    });
  }

  copyBlobToClipboard(button, blob, mimeType, base64Data) {
    console.log('copyBlobToClipboard called with mimeType:', mimeType, 'blob size:', blob.size);
    return new Promise((resolve, reject) => {
      // Проверяем поддержку ClipboardItem
      if (typeof ClipboardItem === 'undefined') {
        console.error('ClipboardItem not supported');
        reject(new Error('ClipboardItem not supported'));
        return;
      }

      // Проверяем поддержку MIME типа, если supports доступен
      if (ClipboardItem.supports && !ClipboardItem.supports(mimeType)) {
        console.warn('MIME type not supported by ClipboardItem:', mimeType);
        reject(new Error('MIME type not supported'));
        return;
      }

      // Копируем файл в буфер обмена
      const clipboardItem = new ClipboardItem({ [mimeType]: blob });
      console.log('ClipboardItem created for', mimeType);

      // Визуальная обратная связь - начинаем копирование
      button.classList.add('copied');
      const originalContent = button.innerHTML;
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      navigator.clipboard.write([clipboardItem]).then(() => {
        console.log('File copied to clipboard successfully');
        // Оставляем анимацию на 2 секунды
        setTimeout(() => {
          button.classList.remove('copied');
          button.innerHTML = originalContent;
        }, 2000);
        resolve();
      }).catch(err => {
        console.error('Ошибка копирования файла:', err);
        // Показываем ошибку
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        `;
        setTimeout(() => {
          button.innerHTML = originalContent;
        }, 2000);
        reject(err);
      });
    });
  }

  copyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
      // Пытаемся использовать Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(() => {
          // Fallback на execCommand
          this.fallbackCopyTextToClipboard(text).then(resolve).catch(reject);
        });
      } else {
        // Fallback на execCommand
        this.fallbackCopyTextToClipboard(text).then(resolve).catch(reject);
      }
    });
  }

  fallbackCopyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          resolve();
        } else {
          reject(new Error('Copy command was unsuccessful'));
        }
      } catch (err) {
        reject(err);
      }
      document.body.removeChild(textArea);
    });
  }

  showForwardPopup(text) {
    this.forwardText = text;
    document.getElementById('forward-popup').classList.add('show');
  }

  // Функция для преобразования названий языков в классы Prism.js
  getPrismLanguageClass(language) {
    const languageMap = {
      'C++': 'cpp',
      'C#': 'csharp',
      'JavaScript': 'javascript',
      'TypeScript': 'typescript',
      'Python': 'python',
      'Java': 'java',
      'PHP': 'php',
      'HTML': 'html',
      'CSS': 'css',
      'SQL': 'sql',
      'Bash': 'bash',
      'Ruby': 'ruby',
      'Go': 'go',
      'Rust': 'rust',
      'Swift': 'swift',
      'Kotlin': 'kotlin'
    };
    
    return languageMap[language] || language.toLowerCase();
  }

  showTypingIndicator() {
    document.getElementById('typing-indicator').style.display = 'flex';
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    document.getElementById('typing-indicator').style.display = 'none';
  }

  setProcessingState(processing) {
    this.isProcessing = processing;
    this.updateSendButton();
  }

  async sendToWebhook(message) {
    // Для тестирования возвращаем фиктивный ответ вместо отправки на вебхук
    // В реальной реализации здесь будет код для отправки на ваш вебхук
    return 'Это тестовый ответ на ваше сообщение: "' + message + '"';
  }

  async sendFileToWebhook(files) {
    // Для тестирования возвращаем фиктивный ответ вместо отправки на вебхук
    // В реальной реализации здесь будет код для отправки на ваш вебхук
    const fileNames = files.map(f => f.name).join(', ');
    return `Файлы "${fileNames}" успешно обработаны!`;
  }

  async sendMessage() {
    console.log('sendMessage called');

    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    console.log('message:', message);
    console.log('attachedFiles:', this.attachedFiles.length);
    console.log('isProcessing:', this.isProcessing);

    if (this.isProcessing) {
      console.log('Processing, returning');
      return;
    }

    // Разрешаем отправку если есть сообщение ИЛИ файлы
    const hasContent = message.length > 0 || this.attachedFiles.length > 0;
    if (!hasContent) {
      console.log('No content, returning');
      return;
    }

    // Сохраняем файлы для отправки
    const filesToSend = [...this.attachedFiles];

    // Добавляем файлы в чат, если они есть
    if (this.attachedFiles.length > 0) {
      for (const file of this.attachedFiles) {
        this.addFileMessage(file, '');
      }
    }

    // Добавляем текстовое сообщение, если есть
    if (message) {
      this.addMessage(message, 'user');
    }

    messageInput.value = '';
    this.adjustTextareaHeight();
    this.clearAttachedFiles();
    this.updateSendButton();

    if (this.isMobile) {
      setTimeout(() => {
        messageInput.blur();
        this.ensureInputAccessible();
      }, 100);
    }

    console.log('Setting processing state to true');
    this.setProcessingState(true);
    this.showTypingIndicator();

    try {
      let response = '';

      // Отправляем файлы, если они есть
      if (filesToSend.length > 0) {
        console.log('Sending files to webhook');
        response = await this.sendFileToWebhook(filesToSend);
      }

      // Отправляем сообщение, если оно есть
      if (message) {
        console.log('Sending message to webhook');
        response = await this.sendToWebhook(message);
      }

      console.log('Received response from webhook:', response);
      this.hideTypingIndicator();

      // Добавляем ответ AI только если был отправлен контент
      if (response) {
        this.addMessage(response, 'ai');
      }

      this.scrollToBottom();
    } catch (error) {
      console.log('Error in sendMessage:', error);
      this.hideTypingIndicator();
      this.addMessage('Извините, произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.', 'ai');
      console.error('Chat error:', error);
      this.scrollToBottom();
    } finally {
      console.log('Finally block - setting processing state to false');
      this.setProcessingState(false);
    }
  }
}

// Инициализация чата
document.addEventListener('DOMContentLoaded', function() {
  // Initialize chat first
  window.deepSeekChat = new DeepSeekChat();

  // Обработчики для кнопок пересылки
  document.querySelectorAll('.forward-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const app = btn.dataset.app;
      const text = window.deepSeekChat.forwardText;
      let url;
      if (app === 'telegram') {
        url = `https://t.me/share/text?text=${encodeURIComponent(text)}`;
      } else if (app === 'vk') {
        url = `https://vk.com/share.php?title=${encodeURIComponent(text)}`;
      } else if (app === 'whatsapp') {
        url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      }
      window.open(url, '_blank');
      document.getElementById('forward-popup').classList.remove('show');
    });
  });

  // Обработчик для кнопки закрытия попапа
  document.querySelector('.close-popup-btn').addEventListener('click', () => {
    document.getElementById('forward-popup').classList.remove('show');
  });

  // Для мобильной версии - скрывать кнопки копирования и пересылки при касании вне них
  if (window.innerWidth <= 768) {
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.message-copy-btn, .message-forward-btn, .message-content')) {
        document.querySelectorAll('.message-copy-btn, .message-forward-btn').forEach(btn => {
          btn.style.opacity = '0';
          btn.style.visibility = 'hidden';
        });
      }
    });
  }

  // Then load LinguistDetector
  loadLinguistDetector().then(() => {
    console.log('LinguistDetector loaded successfully');
    // Initialize the detector in the existing chat instance
    if (window.deepSeekChat && typeof LinguistDetector !== 'undefined') {
      window.deepSeekChat.linguistDetector = new LinguistDetector();
    }
  }).catch((error) => {
    console.error('Failed to load LinguistDetector:', error);
  });
});
