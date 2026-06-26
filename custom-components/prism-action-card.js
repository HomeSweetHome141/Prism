class PrismActionCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartValue = 0;
    this._boundHandlers = null;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.tesla_vehicle',
      name: 'Tesla Charge',
      icon: 'mdi:ev-station',
      layout: 'horizontal',
      active_color: '#00b8ff',
      show_state: true,
      button_label: 'Start Charge',
      action_service: 'tesla.start_charge',
      slider_entity: 'number.aurora_charge_current',
      slider_name: 'Current',
      show_slider_value: true
    };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: 'entity',
          required: false,
          selector: { entity: {} }
        },
        {
          name: 'name',
          selector: { text: {} }
        },
        {
          name: 'icon',
          selector: { icon: {} }
        },
        {
          name: 'layout',
          selector: {
            select: {
              options: ['horizontal', 'vertical']
            }
          }
        },
        {
          name: 'active_color',
          selector: { color_rgb: {} }
        },
        {
          name: 'show_state',
          label: 'Show state below name',
          default: true,
          selector: { boolean: {} }
        },
        {
          name: 'button_label',
          label: 'Button label',
          selector: { text: {} }
        },
        {
          name: 'action_service',
          label: 'Start action service',
          selector: { text: {} }
        },
        {
          name: 'action_service_data',
          label: 'Service data',
          selector: { object: {} }
        },
        {
          name: 'slider_entity',
          label: 'Slider entity',
          selector: { entity: { domain: 'number' } }
        },
        {
          name: 'slider_name',
          label: 'Slider label',
          selector: { text: {} }
        },
        {
          name: 'show_slider_value',
          label: 'Show slider value',
          default: true,
          selector: { boolean: {} }
        }
      ]
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Please provide a valid config');
    }

    this._config = { ...config };
    this._config.layout = this._config.layout || 'horizontal';
    this._config.icon = this._config.icon || 'mdi:ev-station';
    this._config.button_label = this._config.button_label || 'Start Charge';
    this._config.slider_name = this._config.slider_name || 'Current';
    if (this._config.active_color) {
      this._config.active_color = this._normalizeColor(this._config.active_color);
    }
    this._config.show_state = this._config.show_state !== false;
    this._config.show_slider_value = this._config.show_slider_value !== false;
    this._updateCard();
  }

  _normalizeColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      const r = color[0].toString(16).padStart(2, '0');
      const g = color[1].toString(16).padStart(2, '0');
      const b = color[2].toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return color;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config) {
      this._updateCard();
    }
  }

  getCardSize() {
    return 1;
  }

  connectedCallback() {
    if (this._config) {
      this._updateCard();
    }
  }

  disconnectedCallback() {
    this._removeEventListeners();
  }

  _removeEventListeners() {
    if (this._boundHandlers && this._card) {
      this._card.removeEventListener('touchstart', this._boundHandlers.touchStart);
      this._card.removeEventListener('touchmove', this._boundHandlers.touchMove);
      this._card.removeEventListener('touchend', this._boundHandlers.touchEnd);
      this._card.removeEventListener('mousedown', this._boundHandlers.mouseDown);
      this._card.removeEventListener('mousemove', this._boundHandlers.mouseMove);
      this._card.removeEventListener('mouseup', this._boundHandlers.mouseUp);
      this._card.removeEventListener('mouseleave', this._boundHandlers.mouseLeave);
      this._card.removeEventListener('click', this._boundHandlers.click);
    }
    this._boundHandlers = null;
    this._card = null;
  }

  _getDisplayEntityId() {
    return this._config.entity || null;
  }

  _isActive() {
    const entityId = this._getDisplayEntityId();
    if (!this._hass || !entityId) return false;
    const entity = this._hass.states[entityId];
    if (!entity) return false;
    const state = entity.state;
    const activeStates = Array.isArray(this._config.active_states)
      ? this._config.active_states
      : ['on', 'open', 'charging', 'active', 'locked'];
    return activeStates.includes(state);
  }

  _getIconColor() {
    if (!this._config.active_color) return null;
    const hex = this._config.active_color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { color: `rgb(${r}, ${g}, ${b})`, shadow: `rgba(${r}, ${g}, ${b}, 0.6)` };
  }

  _sliderEntity() {
    return this._config.slider_entity || null;
  }

  _hasSlider() {
    const sliderId = this._sliderEntity();
    if (!this._hass || !sliderId) return false;
    const entity = this._hass.states[sliderId];
    return !!entity && sliderId.startsWith('number.');
  }

  _getSliderValue() {
    if (!this._hass || !this._sliderEntity()) return 0;
    const entity = this._hass.states[this._sliderEntity()];
    if (!entity) return 0;
    const value = parseFloat(entity.state);
    return isNaN(value) ? 0 : value;
  }

  _getSliderRange() {
    const sliderId = this._sliderEntity();
    const defaultRange = { min: 0, max: 100, step: 1 };
    if (!this._hass || !sliderId) return defaultRange;
    const entity = this._hass.states[sliderId];
    if (!entity) return defaultRange;
    return {
      min: typeof entity.attributes.min === 'number' ? entity.attributes.min : defaultRange.min,
      max: typeof entity.attributes.max === 'number' ? entity.attributes.max : defaultRange.max,
      step: typeof entity.attributes.step === 'number' ? entity.attributes.step : defaultRange.step
    };
  }

  _setSliderValue(value) {
    const sliderId = this._sliderEntity();
    if (!this._hass || !sliderId) return;
    value = Math.round(value * 100) / 100;
    this._hass.callService('number', 'set_value', {
      entity_id: sliderId,
      value: value
    });
  }

  _handleTap() {
    this._performAction();
  }

  _performAction() {
    if (!this._hass || !this._config.action_service) return;
    const [domain, service] = this._config.action_service.split('.');
    if (!domain || !service) return;
    const serviceData = { ...(this._config.action_service_data || {}) };
    if (this._config.entity && !serviceData.entity_id) {
      serviceData.entity_id = this._config.entity;
    }
    this._hass.callService(domain, service, serviceData);
  }

  _formatValue(value) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return Number.isInteger(num) ? num.toString() : num.toFixed(1);
    }
    return value;
  }

  _updateCard() {
    if (!this._config) return;
    const displayEntityId = this._getDisplayEntityId();
    const entity = displayEntityId && this._hass ? this._hass.states[displayEntityId] : null;
    const isActive = this._isActive();
    const iconColor = this._getIconColor();
    const state = entity ? entity.state : 'unknown';
    const friendlyName = this._config.name || (entity ? entity.attributes.friendly_name || displayEntityId : displayEntityId || 'Action');
    const displayIcon = this._config.icon || 'mdi:ev-station';
    const layout = this._config.layout || 'horizontal';
    const hasSlider = this._hasSlider();
    const sliderValue = hasSlider ? this._getSliderValue() : 0;
    const sliderRange = this._getSliderRange();
    const rangeSpan = Math.max(sliderRange.max - sliderRange.min, 1);
    let sliderPercent = 0;
    if (hasSlider) {
      sliderPercent = ((sliderValue - sliderRange.min) / rangeSpan) * 100;
      sliderPercent = Math.max(0, Math.min(100, sliderPercent));
    }
    const stateDisplay = this._config.show_state
      ? (entity ? `${this._formatValue(state)}${entity.attributes.unit_of_measurement ? ' ' + entity.attributes.unit_of_measurement : ''}` : 'Ready')
      : '';
    const sliderDisplay = hasSlider && this._config.show_slider_value
      ? `${this._config.slider_name || 'Current'}: ${this._formatValue(sliderValue)}${this._hass.states[this._sliderEntity()]?.attributes?.unit_of_measurement || ''}`
      : '';
    const buttonLabel = this._config.button_label || 'Start Charge';
    const accentColor = iconColor ? iconColor.color : 'rgb(0, 184, 255)';
    const glowOpacity = isActive ? 0.45 : 0.08;
    const glowRadius = isActive ? 20 : 6;

    this._removeEventListeners();
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          background: ${isActive ? 'rgba(230, 248, 255, 0.72)' : 'rgba(255, 255, 255, 0.64)'} !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
          border-radius: 18px !important;
          border: 1px solid rgba(255, 255, 255, 0.75) !important;
          box-shadow: ${isActive ? '0 18px 30px -18px rgba(0, 184, 255, 0.45)' : '0 12px 22px -12px rgba(15, 23, 42, 0.16)'} !important;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
          min-height: 76px !important;
          position: relative;
          overflow: hidden;
        }
        ha-card:hover {
          transform: translateY(-1px);
        }
        .card-content {
          display: flex;
          flex-direction: ${layout === 'vertical' ? 'column' : 'row'};
          align-items: center;
          gap: 16px;
          padding: 16px;
          position: relative;
          z-index: 1;
        }
        .icon-container {
          width: 46px;
          height: 46px;
          min-width: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .icon-circle {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: ${iconColor ? `linear-gradient(145deg, ${accentColor}, rgba(255,255,255,0.35))` : 'rgba(255,255,255,0.7)'};
          box-shadow: 0 0 ${glowRadius}px ${glowOpacity} ${accentColor}, inset 1px 1px 3px rgba(255,255,255,0.8);
        }
        .icon-wrapper {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        ha-icon {
          --mdc-icon-size: 24px;
          color: ${iconColor ? accentColor : 'rgba(0, 0, 0, 0.65)'} !important;
          filter: drop-shadow(0 0 4px rgba(0,0,0,0.08));
        }
        .info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          ${layout === 'vertical' ? 'text-align: center;' : ''}
        }
        .name {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .state {
          margin-top: 4px;
          font-size: 12px;
          color: #4b5563;
          font-weight: 500;
          text-transform: capitalize;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .button-label {
          margin-top: ${this._config.show_state ? '8px' : '4px'};
          font-size: 13px;
          font-weight: 600;
          color: ${accentColor};
        }
        .slider-row {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: ${layout === 'vertical' ? '12px' : '0'};
        }
        .slider-bar {
          width: 100%;
          height: 10px;
          background: rgba(15, 23, 42, 0.08);
          border-radius: 999px;
          overflow: hidden;
        }
        .slider-bar-fill {
          width: ${sliderPercent}%;
          height: 100%;
          background: linear-gradient(90deg, ${accentColor}, rgba(0, 184, 255, 0.55));
          transition: width 0.2s ease;
        }
        .slider-caption {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #6b7280;
        }
        .slider-caption .label {
          font-weight: 500;
        }
        .slider-caption .value {
          font-weight: 700;
          color: #111827;
        }
        .slider-cover {
          position: absolute;
          inset: 0;
          z-index: 2;
        }
      </style>
      <ha-card>
        <div class="card-content">
          <div class="icon-container">
            <div class="icon-circle"></div>
            <div class="icon-wrapper"><ha-icon icon="${displayIcon}"></ha-icon></div>
          </div>
          <div class="info">
            <div class="name">${friendlyName}</div>
            ${this._config.show_state ? `<div class="state">${stateDisplay}</div>` : ''}
            <div class="button-label">${buttonLabel}</div>
            ${hasSlider ? `
              <div class="slider-row">
                <div class="slider-bar"><div class="slider-bar-fill"></div></div>
                ${this._config.show_slider_value ? `<div class="slider-caption"><span class="label">${this._config.slider_name || 'Current'}</span><span class="value">${sliderDisplay}</span></div>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="slider-cover"></div>
        </div>
      </ha-card>
    `;

    const card = this.shadowRoot.querySelector('ha-card');
    this._card = card;
    if (!card) return;

    const handleInteractionStart = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      this._dragStartX = clientX;
      this._dragStartValue = sliderValue;
      this._isDragging = false;
    };

    const handleInteractionMove = (e) => {
      if (!hasSlider) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const deltaX = Math.abs(clientX - this._dragStartX);
      if (deltaX < 8) return;
      this._isDragging = true;
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const value = sliderRange.min + (percent / 100) * rangeSpan;
      const rounded = Math.round(value / sliderRange.step) * sliderRange.step;
      const newValue = Math.max(sliderRange.min, Math.min(sliderRange.max, rounded));
      const fill = this.shadowRoot.querySelector('.slider-bar-fill');
      if (fill) {
        fill.style.width = `${((newValue - sliderRange.min) / rangeSpan) * 100}%`;
      }
      const valueEl = this.shadowRoot.querySelector('.slider-caption .value');
      if (valueEl) {
        const unit = this._hass.states[this._sliderEntity()]?.attributes?.unit_of_measurement || '';
        valueEl.textContent = `${this._formatValue(newValue)}${unit ? ' ' + unit : ''}`;
      }
    };

    const handleInteractionEnd = (e) => {
      if (!hasSlider || !this._isDragging) {
        this._handleTap();
        return;
      }
      e.preventDefault();
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const rect = card.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const value = sliderRange.min + (percent / 100) * rangeSpan;
      const rounded = Math.round(value / sliderRange.step) * sliderRange.step;
      const newValue = Math.max(sliderRange.min, Math.min(sliderRange.max, rounded));
      this._setSliderValue(newValue);
      this._isDragging = false;
    };

    this._boundHandlers = {
      touchStart: handleInteractionStart,
      touchMove: handleInteractionMove,
      touchEnd: handleInteractionEnd,
      mouseDown: handleInteractionStart,
      mouseMove: (e) => {
        if (e.buttons === 1) {
          handleInteractionMove(e);
        }
      },
      mouseUp: handleInteractionEnd,
      mouseLeave: () => {
        if (this._isDragging) {
          this._isDragging = false;
        }
      },
      click: (e) => {
        if (!this._isDragging) {
          this._handleTap();
        }
      }
    };

    card.addEventListener('touchstart', this._boundHandlers.touchStart, { passive: true });
    card.addEventListener('touchmove', this._boundHandlers.touchMove, { passive: false });
    card.addEventListener('touchend', this._boundHandlers.touchEnd);
    card.addEventListener('mousedown', this._boundHandlers.mouseDown);
    card.addEventListener('mousemove', this._boundHandlers.mouseMove);
    card.addEventListener('mouseup', this._boundHandlers.mouseUp);
    card.addEventListener('mouseleave', this._boundHandlers.mouseLeave);
    card.addEventListener('click', this._boundHandlers.click);
  }
}

customElements.define('prism-action-card', PrismActionCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'prism-action-card',
  name: 'Prism Action Card',
  preview: true,
  description: 'A glass-style action card with a start button and current slider for charging or other dual-action flows.'
});
