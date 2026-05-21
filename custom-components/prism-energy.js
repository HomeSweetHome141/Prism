/**
 * Prism Energy Card
 * A glassmorphism energy flow card for Home Assistant
 * Designed for OpenEMS/Fenecon integration
 * 
 * Features:
 * - Animated energy flow visualization
 * - Weather effects (rain, snow, fog, sun, moon, stars)
 * - Day/Night transitions with house dimming
 * - Sunrise/Sunset effects
 * 
 * @version 1.3.6
 * @author BangerTech
 */

class PrismEnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._animationFrame = null;
  }

  static _overlayPanel(prefix, title, options = {}) {
    const schema = [
      {
        name: `${prefix}_enabled`,
        label: "Enable overlay",
        default: options.defaultEnabled !== false,
        selector: { boolean: {} }
      }
    ];
    if (options.entityField) {
      schema.push({
        name: `${prefix}_entity`,
        label: options.entityLabel || "Sensor entity",
        selector: { entity: { domain: "sensor" } }
      });
    }
    schema.push(
      {
        name: `${prefix}_label`,
        label: "Label (optional)",
        selector: { text: {} }
      },
      {
        name: `${prefix}_show_label`,
        label: "Show label",
        selector: { boolean: {} }
      },
      {
        name: `${prefix}_icon`,
        label: "Icon",
        selector: { icon: {} }
      },
      {
        name: `${prefix}_color`,
        label: "Color",
        selector: { color_rgb: {} }
      },
      {
        name: `${prefix}_opacity`,
        label: "Transparency (0 = hidden, 1 = solid)",
        selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } }
      },
      {
        name: `${prefix}_glow`,
        label: "Glow intensity (0 = none, 1 = strong)",
        selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } }
      },
      {
        name: `${prefix}_angle`,
        label: "Rotation (degrees)",
        selector: { number: { min: -180, max: 180, step: 1, mode: "box" } }
      },
      {
        name: `${prefix}_show_icon`,
        label: "Show icon",
        selector: { boolean: {} }
      },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: `${prefix}_top`,
            label: "Position top %",
            selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
          },
          {
            name: `${prefix}_left`,
            label: "Position left %",
            selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
          },
          {
            name: `${prefix}_scale`,
            label: "Size",
            selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
          }
        ]
      }
    );
    return { type: "expandable", name: "", title, schema };
  }

  static _applyOverlayConfig(target, config) {
    const defs = {
      battery_charge_overlay: {
        enabled: true, label: "Charge", show_label: false, icon: "mdi:battery-arrow-up",
        color: [234, 179, 8], opacity: 1, glow: 0.45, angle: 0, show_icon: true,
        top: 56, left: 94, scale: 0.9, entity: ""
      },
      battery_discharge_overlay: {
        enabled: true, label: "Discharge", show_label: false, icon: "mdi:battery-arrow-down",
        color: [34, 197, 94], opacity: 1, glow: 0.45, angle: 0, show_icon: true,
        top: 64, left: 94, scale: 0.9, entity: ""
      },
      ev_soc_overlay: {
        enabled: true, label: "EV", show_label: false, icon: "mdi:car-electric",
        color: [125, 211, 252], opacity: 1, glow: 0.4, angle: 0, show_icon: true,
        top: 78, left: 26, scale: 0.85, entity: ""
      },
      inverter_temp_overlay: {
        enabled: true, label: "Inverter", show_label: true, icon: "mdi:solar-power-variant",
        color: [251, 146, 60], opacity: 1, glow: 0.5, angle: -12, show_icon: true,
        top: 18, left: 72, scale: 0.85, entity: ""
      },
      battery_temp_overlay: {
        enabled: true, label: "Battery", show_label: true, icon: "mdi:thermometer",
        color: [248, 113, 113], opacity: 1, glow: 0.5, angle: 12, show_icon: true,
        top: 48, left: 92, scale: 0.85, entity: ""
      },
      tesla_connected_overlay: {
        enabled: true, label: "Tesla", show_label: true, icon: "mdi:car-connected",
        color: [226, 74, 74], opacity: 1, glow: 0.5, angle: 0, show_icon: true,
        top: 70, left: 28, scale: 0.85, entity: ""
      }
    };
    for (const [prefix, def] of Object.entries(defs)) {
      target[`${prefix}_enabled`] = config[`${prefix}_enabled`] !== false;
      target[`${prefix}_entity`] = config[`${prefix}_entity`] || def.entity || "";
      target[`${prefix}_label`] = config[`${prefix}_label`] ?? def.label;
      target[`${prefix}_show_label`] = config[`${prefix}_show_label`] !== undefined
        ? config[`${prefix}_show_label`] === true
        : !!def.show_label;
      target[`${prefix}_icon`] = config[`${prefix}_icon`] || def.icon;
      target[`${prefix}_color`] = config[`${prefix}_color`] || def.color;
      target[`${prefix}_opacity`] = config[`${prefix}_opacity`] ?? def.opacity;
      target[`${prefix}_glow`] = config[`${prefix}_glow`] ?? def.glow;
      target[`${prefix}_angle`] = config[`${prefix}_angle`] ?? def.angle;
      target[`${prefix}_show_icon`] = config[`${prefix}_show_icon`] !== false;
      target[`${prefix}_top`] = config[`${prefix}_top`] ?? def.top;
      target[`${prefix}_left`] = config[`${prefix}_left`] ?? def.left;
      target[`${prefix}_scale`] = config[`${prefix}_scale`] ?? def.scale;
    }
  }

  static _customPillActionFields(index) {
    return [
      {
        name: `custom_pill_${index}_tap_action`,
        label: "Tap action",
        selector: {
          select: {
            options: [
              { value: "toggle", label: "Toggle (on/off, run automation)" },
              { value: "more-info", label: "More info" },
              { value: "navigate", label: "Navigate" },
              { value: "call-service", label: "Call service" },
              { value: "none", label: "None" }
            ],
            mode: "dropdown"
          }
        }
      },
      {
        name: `custom_pill_${index}_navigation_path`,
        label: "Navigation path (for navigate)",
        selector: { text: {} }
      },
      {
        name: `custom_pill_${index}_service`,
        label: "Service (for call-service, e.g. scene.turn_on)",
        selector: { text: {} }
      },
      {
        name: `custom_pill_${index}_service_data`,
        label: "Service data (optional)",
        selector: { object: {} }
      }
    ];
  }

  static getStubConfig() {
    return {
      name: "Energy Monitor",
      show_header_icon: true,
      header_icon: "mdi:solar-power-variant",
      solar_power: "",
      grid_power: "",
      grid_import: "",
      grid_export: "",
      battery_soc: "",
      battery_power: "",
      battery_charge: "",
      battery_discharge: "",
      home_consumption: "",
      ev_power: "",
      autarky: "",
      image: "/local/community/Prism-Dashboard/images/prism-energy-home.png",
      max_solar_power: 10000,
      max_grid_power: 10000,
      max_consumption: 10000,
      // Weather effects (optional)
      enable_weather_effects: false,
      weather_entity: "",
      cloud_coverage_entity: "",
      // Solar modules (optional)
      solar_module1: "",
      solar_module1_name: "",
      solar_module2: "",
      solar_module2_name: "",
      solar_module3: "",
      solar_module3_name: "",
      solar_module4: "",
      solar_module4_name: "",
      // Pill positions (optional - in percent)
      solar_pill_top: 22,
      solar_pill_left: 52,
      solar_pill_scale: 1.0,
      grid_pill_top: 32,
      grid_pill_left: 18,
      grid_pill_scale: 1.0,
      home_pill_top: 54,
      home_pill_left: 55,
      home_pill_scale: 1.0,
      battery_pill_top: 60,
      battery_pill_left: 88,
      battery_pill_scale: 1.0,
      ev_pill_top: 72,
      ev_pill_left: 22,
      ev_pill_scale: 1.0,
      // Custom Pills (optional)
      custom_pill_1_entity: "",
      custom_pill_1_icon: "mdi:thermometer",
      custom_pill_1_label: "",
      custom_pill_1_color: [34, 211, 238],
      custom_pill_1_show_label: true,
      custom_pill_1_top: 85,
      custom_pill_1_left: 35,
      custom_pill_1_scale: 1.0,
      custom_pill_2_entity: "",
      custom_pill_2_icon: "mdi:weather-windy",
      custom_pill_2_label: "",
      custom_pill_2_color: [96, 165, 250],
      custom_pill_2_show_label: true,
      custom_pill_2_top: 85,
      custom_pill_2_left: 50,
      custom_pill_2_scale: 1.0,
      custom_pill_3_entity: "",
      custom_pill_3_icon: "mdi:water-percent",
      custom_pill_3_label: "",
      custom_pill_3_color: [74, 222, 128],
      custom_pill_3_show_label: true,
      custom_pill_3_top: 85,
      custom_pill_3_left: 65,
      custom_pill_3_scale: 1.0,
      custom_pill_4_entity: "",
      custom_pill_4_icon: "mdi:gauge",
      custom_pill_4_label: "",
      custom_pill_4_color: [168, 85, 247],
      custom_pill_4_show_label: true,
      custom_pill_4_top: 88,
      custom_pill_4_left: 20,
      custom_pill_4_scale: 1.0,
      custom_pill_5_entity: "",
      custom_pill_5_icon: "mdi:flash",
      custom_pill_5_label: "",
      custom_pill_5_color: [251, 191, 36],
      custom_pill_5_show_label: true,
      custom_pill_5_top: 88,
      custom_pill_5_left: 40,
      custom_pill_5_scale: 1.0,
      custom_pill_6_entity: "",
      custom_pill_6_icon: "mdi:information",
      custom_pill_6_label: "",
      custom_pill_6_color: [244, 114, 182],
      custom_pill_6_show_label: true,
      custom_pill_6_top: 88,
      custom_pill_6_left: 80,
      custom_pill_6_scale: 1.0,
      custom_pill_7_entity: "",
      custom_pill_7_icon: "mdi:home",
      custom_pill_7_label: "",
      custom_pill_7_color: [56, 189, 248],
      custom_pill_7_show_label: true,
      custom_pill_7_top: 92,
      custom_pill_7_left: 30,
      custom_pill_7_scale: 1.0,
      custom_pill_8_entity: "",
      custom_pill_8_icon: "mdi:leaf",
      custom_pill_8_label: "",
      custom_pill_8_color: [52, 211, 153],
      custom_pill_8_show_label: true,
      custom_pill_8_top: 92,
      custom_pill_8_left: 70,
      custom_pill_8_scale: 1.0,
      battery_charge_overlay_enabled: true,
      battery_charge_overlay_label: "Charge",
      battery_charge_overlay_show_label: false,
      battery_charge_overlay_icon: "mdi:battery-arrow-up",
      battery_charge_overlay_color: [234, 179, 8],
      battery_charge_overlay_opacity: 1.0,
      battery_charge_overlay_glow: 0.45,
      battery_charge_overlay_angle: 0,
      battery_charge_overlay_show_icon: true,
      battery_charge_overlay_top: 56,
      battery_charge_overlay_left: 94,
      battery_charge_overlay_scale: 0.9,
      battery_discharge_overlay_enabled: true,
      battery_discharge_overlay_label: "Discharge",
      battery_discharge_overlay_show_label: false,
      battery_discharge_overlay_icon: "mdi:battery-arrow-down",
      battery_discharge_overlay_color: [34, 197, 94],
      battery_discharge_overlay_opacity: 1.0,
      battery_discharge_overlay_glow: 0.45,
      battery_discharge_overlay_angle: 0,
      battery_discharge_overlay_show_icon: true,
      battery_discharge_overlay_top: 64,
      battery_discharge_overlay_left: 94,
      battery_discharge_overlay_scale: 0.9,
      ev_soc_overlay_enabled: true,
      ev_soc_overlay_label: "EV",
      ev_soc_overlay_show_label: false,
      ev_soc_overlay_icon: "mdi:car-electric",
      ev_soc_overlay_color: [125, 211, 252],
      ev_soc_overlay_opacity: 1.0,
      ev_soc_overlay_glow: 0.4,
      ev_soc_overlay_angle: 0,
      ev_soc_overlay_show_icon: true,
      ev_soc_overlay_top: 78,
      ev_soc_overlay_left: 26,
      ev_soc_overlay_scale: 0.85,
      inverter_temp_overlay_entity: "",
      inverter_temp_overlay_enabled: true,
      inverter_temp_overlay_label: "Inverter",
      inverter_temp_overlay_show_label: true,
      inverter_temp_overlay_icon: "mdi:solar-power-variant",
      inverter_temp_overlay_color: [251, 146, 60],
      inverter_temp_overlay_opacity: 1.0,
      inverter_temp_overlay_glow: 0.5,
      inverter_temp_overlay_angle: -12,
      inverter_temp_overlay_show_icon: true,
      inverter_temp_overlay_top: 18,
      inverter_temp_overlay_left: 72,
      inverter_temp_overlay_scale: 0.85,
      battery_temp_overlay_entity: "",
      battery_temp_overlay_enabled: true,
      battery_temp_overlay_label: "Battery",
      battery_temp_overlay_show_label: true,
      battery_temp_overlay_icon: "mdi:thermometer",
      battery_temp_overlay_color: [248, 113, 113],
      battery_temp_overlay_opacity: 1.0,
      battery_temp_overlay_glow: 0.5,
      battery_temp_overlay_angle: 12,
      battery_temp_overlay_show_icon: true,
      battery_temp_overlay_top: 48,
      battery_temp_overlay_left: 92,
      battery_temp_overlay_scale: 0.85,
      tesla_connected_overlay_entity: "",
      tesla_connected_overlay_enabled: true,
      tesla_connected_overlay_label: "Tesla",
      tesla_connected_overlay_show_label: true,
      tesla_connected_overlay_icon: "mdi:car-connected",
      tesla_connected_overlay_color: [226, 74, 74],
      tesla_connected_overlay_opacity: 1.0,
      tesla_connected_overlay_glow: 0.5,
      tesla_connected_overlay_angle: 0,
      tesla_connected_overlay_show_icon: true,
      tesla_connected_overlay_top: 70,
      tesla_connected_overlay_left: 28,
      tesla_connected_overlay_scale: 0.85,
      status_pill_top: 12,
      status_pill_left: 78,
      status_pill_scale: 1.0
    };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "name",
          label: "Card Name",
          selector: { text: {} }
        },
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "show_header_icon",
              label: "Show header icon",
              default: true,
              selector: { boolean: {} }
            },
            {
              name: "header_icon",
              label: "Header icon",
              selector: { icon: {} }
            }
          ]
        },
        {
          name: "image",
          label: "Image URL (default: prism-energy-home.png)",
          selector: { text: {} }
        },
        {
          name: "show_details",
          label: "Show details section at bottom",
          default: true,
          selector: { boolean: {} }
        },
        {
          name: "",
          type: "divider"
        },
        {
          name: "solar_power",
          label: "Solar Power (Total)",
          required: true,
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "grid_power",
          label: "Grid Power â€“ combined (optional if import/export set; +import, âˆ’export)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "grid_import",
          label: "Grid Import Power (optional, separate sensor)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "grid_export",
          label: "Grid Export Power (optional, separate sensor)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "battery_soc",
          label: "Battery SOC %",
          required: true,
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "battery_power",
          label: "Battery Power â€“ combined (optional if charge/discharge set; +discharge, âˆ’charge)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "battery_charge",
          label: "Battery Charge Power (optional, separate sensor)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "battery_discharge",
          label: "Battery Discharge Power (optional, separate sensor)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "home_consumption",
          label: "Home Consumption",
          required: true,
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "ev_power",
          label: "EV Charging Power (optional)",
          selector: { entity: { domain: "sensor" } }
        },
        {
          name: "ev_label",
          label: "EV pill label",
          selector: { text: {} }
        },
        {
          name: "ev_soc_entity",
          label: "EV battery % overlay (optional)",
          selector: { entity: {} }
        },
        {
          name: "status_entity",
          label: "Status pill entity (optional, any entity)",
          selector: { entity: {} }
        },
        {
          name: "status_icon",
          label: "Status pill icon",
          selector: { icon: {} }
        },
        {
          name: "status_label",
          label: "Status pill label (optional)",
          selector: { text: {} }
        },
        {
          name: "status_show_label",
          label: "Show status label",
          selector: { boolean: {} }
        },
        {
          name: "",
          type: "divider"
        },
        {
          type: "expandable",
          name: "",
          title: "Weather & Day/Night Animation",
          schema: [
            {
              name: "enable_weather_effects",
              label: "Enable weather effects",
              selector: { boolean: {} }
            },
            {
              name: "weather_entity",
              label: "Weather Entity (e.g. weather.home)",
              selector: { entity: { domain: "weather" } }
            },
            {
              name: "cloud_coverage_entity",
              label: "Cloud Coverage Sensor (optional, e.g. sensor.openweathermap_cloud_coverage)",
              selector: { entity: { domain: "sensor" } }
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "Maximum Values for Progress Bars",
          schema: [
            {
              name: "max_solar_power",
              label: "Max Solar Power (Watts) - e.g. 10000 for 10kW",
              selector: { number: { min: 1000, max: 100000, step: 100, mode: "box", unit_of_measurement: "W" } }
            },
            {
              name: "max_grid_power",
              label: "Max Grid Power (Watts)",
              selector: { number: { min: 1000, max: 100000, step: 100, mode: "box", unit_of_measurement: "W" } }
            },
            {
              name: "max_consumption",
              label: "Max Consumption (Watts)",
              selector: { number: { min: 1000, max: 100000, step: 100, mode: "box", unit_of_measurement: "W" } }
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "Solar Modules (optional - for individual display)",
          schema: [
            {
              name: "solar_module1",
              label: "Solar Module 1 (Entity)",
              selector: { entity: { domain: "sensor" } }
            },
            {
              name: "solar_module1_name",
              label: "Module 1 Name (e.g. Roof East)",
              selector: { text: {} }
            },
            {
              name: "solar_module2",
              label: "Solar Module 2 (Entity)",
              selector: { entity: { domain: "sensor" } }
            },
            {
              name: "solar_module2_name",
              label: "Module 2 Name (e.g. Roof West)",
              selector: { text: {} }
            },
            {
              name: "solar_module3",
              label: "Solar Module 3 (Entity)",
              selector: { entity: { domain: "sensor" } }
            },
            {
              name: "solar_module3_name",
              label: "Module 3 Name (e.g. Garage)",
              selector: { text: {} }
            },
            {
              name: "solar_module4",
              label: "Solar Module 4 (Entity)",
              selector: { entity: { domain: "sensor" } }
            },
            {
              name: "solar_module4_name",
              label: "Module 4 Name",
              selector: { text: {} }
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "Pill Positions & Size (optional)",
          schema: [
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "solar_pill_top",
                  label: "Solar pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "solar_pill_left",
                  label: "Solar pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "solar_pill_scale",
                  label: "Solar pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "grid_pill_top",
                  label: "Grid pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "grid_pill_left",
                  label: "Grid pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "grid_pill_scale",
                  label: "Grid pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "home_pill_top",
                  label: "Home pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "home_pill_left",
                  label: "Home pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "home_pill_scale",
                  label: "Home pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "battery_pill_top",
                  label: "Battery pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "battery_pill_left",
                  label: "Battery pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "battery_pill_scale",
                  label: "Battery pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "ev_pill_top",
                  label: "Ev pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "ev_pill_left",
                  label: "Ev pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "ev_pill_scale",
                  label: "Ev pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "status_pill_top",
                  label: "Status pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "status_pill_left",
                  label: "Status pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "status_pill_scale",
                  label: "Status pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "Power Overlays (optional)",
          schema: [
            PrismEnergyCard._overlayPanel("battery_charge_overlay", "Battery Charge Overlay"),
            PrismEnergyCard._overlayPanel("battery_discharge_overlay", "Battery Discharge Overlay"),
            PrismEnergyCard._overlayPanel("ev_soc_overlay", "EV SOC Overlay"),
            PrismEnergyCard._overlayPanel("inverter_temp_overlay", "Inverter Temperature Overlay", {
              entityField: true,
              entityLabel: "Inverter temperature sensor"
            }),
            PrismEnergyCard._overlayPanel("battery_temp_overlay", "Battery Temperature Overlay", {
              entityField: true,
              entityLabel: "Battery temperature sensor"
            }),
            PrismEnergyCard._overlayPanel("tesla_connected_overlay", "Tesla Connected Overlay", {
              entityField: true,
              entityLabel: "Tesla connected sensor (binary_sensor or sensor)"
            })
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "Custom Pills (optional)",
          schema: [
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 1",
              schema: [
                {
                  name: "custom_pill_1_entity",
                  label: "Entity (e.g. sensor.outdoor_temperature)",
                  selector: { entity: { domain: "sensor" } }
                },
                {
                  name: "custom_pill_1_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_1_label",
                  label: "Label (optional, e.g. 'AuÃŸen')",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_1_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_1_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_1_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_1_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_1_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(1)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 2",
              schema: [
                {
                  name: "custom_pill_2_entity",
                  label: "Entity (e.g. sensor.wind_speed)",
                  selector: { entity: { domain: "sensor" } }
                },
                {
                  name: "custom_pill_2_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_2_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_2_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_2_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_2_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_2_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_2_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(2)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 3",
              schema: [
                {
                  name: "custom_pill_3_entity",
                  label: "Entity (e.g. sensor.rain_probability)",
                  selector: { entity: { domain: "sensor" } }
                },
                {
                  name: "custom_pill_3_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_3_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_3_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_3_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_3_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_3_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_3_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(3)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 4",
              schema: [
                {
                  name: "custom_pill_4_entity",
                  label: "Entity",
                  selector: { entity: {} }
                },
                {
                  name: "custom_pill_4_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_4_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_4_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_4_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_4_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_4_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_4_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(4)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 5",
              schema: [
                {
                  name: "custom_pill_5_entity",
                  label: "Entity",
                  selector: { entity: {} }
                },
                {
                  name: "custom_pill_5_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_5_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_5_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_5_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_5_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_5_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_5_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(5)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 6",
              schema: [
                {
                  name: "custom_pill_6_entity",
                  label: "Entity",
                  selector: { entity: {} }
                },
                {
                  name: "custom_pill_6_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_6_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_6_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_6_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_6_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_6_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_6_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(6)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 7",
              schema: [
                {
                  name: "custom_pill_7_entity",
                  label: "Entity",
                  selector: { entity: {} }
                },
                {
                  name: "custom_pill_7_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_7_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_7_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_7_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_7_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_7_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_7_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(7)
              ]
            },
            {
              type: "expandable",
              name: "",
              title: "Custom Pill 8",
              schema: [
                {
                  name: "custom_pill_8_entity",
                  label: "Entity",
                  selector: { entity: {} }
                },
                {
                  name: "custom_pill_8_icon",
                  label: "Icon",
                  selector: { icon: {} }
                },
                {
                  name: "custom_pill_8_label",
                  label: "Label (optional)",
                  selector: { text: {} }
                },
                {
                  name: "custom_pill_8_color",
                  label: "Icon Color",
                  selector: { color_rgb: {} }
                },
                {
                  name: "custom_pill_8_show_label",
                  label: "Show label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "custom_pill_8_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_8_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "custom_pill_8_scale",
                      label: "Size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                },
                ...PrismEnergyCard._customPillActionFields(8)
              ]
            }
          ]
        }
      ]
    };
  }

  setConfig(config) {
    this._config = {
      name: config.name || "Energy Monitor",
      show_header_icon: config.show_header_icon !== false,
      header_icon: config.header_icon || "mdi:solar-power-variant",
      solar_power: config.solar_power || "",
      grid_power: config.grid_power || "",
      grid_import: config.grid_import || "",
      grid_export: config.grid_export || "",
      battery_soc: config.battery_soc || "",
      battery_power: config.battery_power || "",
      battery_charge: config.battery_charge || "",
      battery_discharge: config.battery_discharge || "",
      home_consumption: config.home_consumption || "",
      ev_power: config.ev_power || "",
      autarky: config.autarky || "",
      image: config.image || "/local/community/Prism-Dashboard/images/prism-energy-home.png",
      show_details: config.show_details !== false,
      // Max values for progress bars (in Watts)
      max_solar_power: config.max_solar_power || 10000,
      max_grid_power: config.max_grid_power || 10000,
      max_consumption: config.max_consumption || 10000,
      // Weather effects
      enable_weather_effects: config.enable_weather_effects || false,
      weather_entity: config.weather_entity || "",
      cloud_coverage_entity: config.cloud_coverage_entity || "",
      // Solar modules
      solar_module1: config.solar_module1 || "",
      solar_module1_name: config.solar_module1_name || "Module 1",
      solar_module2: config.solar_module2 || "",
      solar_module2_name: config.solar_module2_name || "Module 2",
      solar_module3: config.solar_module3 || "",
      solar_module3_name: config.solar_module3_name || "Module 3",
      solar_module4: config.solar_module4 || "",
      solar_module4_name: config.solar_module4_name || "Module 4",
      // Pill positions (in percent) - default values match current layout
      solar_pill_top: config.solar_pill_top ?? 22,
      solar_pill_left: config.solar_pill_left ?? 52,
      solar_pill_scale: config.solar_pill_scale ?? 1.0,
      grid_pill_top: config.grid_pill_top ?? 32,
      grid_pill_left: config.grid_pill_left ?? 18,
      grid_pill_scale: config.grid_pill_scale ?? 1.0,
      home_pill_top: config.home_pill_top ?? 54,
      home_pill_left: config.home_pill_left ?? 55,
      home_pill_scale: config.home_pill_scale ?? 1.0,
      battery_pill_top: config.battery_pill_top ?? 60,
      battery_pill_left: config.battery_pill_left ?? 88,
      battery_pill_scale: config.battery_pill_scale ?? 1.0,
      ev_pill_top: config.ev_pill_top ?? 72,
      ev_pill_left: config.ev_pill_left ?? 22,
      ev_pill_scale: config.ev_pill_scale ?? 1.0,
      ev_label: config.ev_label || "EV",
      ev_soc_entity: config.ev_soc_entity || "",
      status_entity: config.status_entity || config.autarky || "",
      status_icon: config.status_icon || "mdi:battery-sync",
      status_label: config.status_label || "",
      status_show_label: config.status_show_label === true,
      status_pill_top: config.status_pill_top ?? 12,
      status_pill_left: config.status_pill_left ?? 78,
      status_pill_scale: config.status_pill_scale ?? 1.0,
      // Custom Pills
      custom_pill_1_entity: config.custom_pill_1_entity || "",
      custom_pill_1_icon: config.custom_pill_1_icon || "mdi:thermometer",
      custom_pill_1_label: config.custom_pill_1_label || "",
      custom_pill_1_color: config.custom_pill_1_color || [34, 211, 238],
      custom_pill_1_show_label: config.custom_pill_1_show_label !== false,
      custom_pill_1_top: config.custom_pill_1_top ?? 85,
      custom_pill_1_left: config.custom_pill_1_left ?? 35,
      custom_pill_1_scale: config.custom_pill_1_scale ?? 1.0,
      custom_pill_2_entity: config.custom_pill_2_entity || "",
      custom_pill_2_icon: config.custom_pill_2_icon || "mdi:weather-windy",
      custom_pill_2_label: config.custom_pill_2_label || "",
      custom_pill_2_color: config.custom_pill_2_color || [96, 165, 250],
      custom_pill_2_show_label: config.custom_pill_2_show_label !== false,
      custom_pill_2_top: config.custom_pill_2_top ?? 85,
      custom_pill_2_left: config.custom_pill_2_left ?? 50,
      custom_pill_2_scale: config.custom_pill_2_scale ?? 1.0,
      custom_pill_3_entity: config.custom_pill_3_entity || "",
      custom_pill_3_icon: config.custom_pill_3_icon || "mdi:water-percent",
      custom_pill_3_label: config.custom_pill_3_label || "",
      custom_pill_3_color: config.custom_pill_3_color || [74, 222, 128],
      custom_pill_3_show_label: config.custom_pill_3_show_label !== false,
      custom_pill_3_top: config.custom_pill_3_top ?? 85,
      custom_pill_3_left: config.custom_pill_3_left ?? 65,
      custom_pill_3_scale: config.custom_pill_3_scale ?? 1.0,
      custom_pill_4_entity: config.custom_pill_4_entity || "",
      custom_pill_4_icon: config.custom_pill_4_icon || "mdi:gauge",
      custom_pill_4_label: config.custom_pill_4_label || "",
      custom_pill_4_color: config.custom_pill_4_color || [168, 85, 247],
      custom_pill_4_show_label: config.custom_pill_4_show_label !== false,
      custom_pill_4_top: config.custom_pill_4_top ?? 88,
      custom_pill_4_left: config.custom_pill_4_left ?? 20,
      custom_pill_4_scale: config.custom_pill_4_scale ?? 1.0,
      custom_pill_5_entity: config.custom_pill_5_entity || "",
      custom_pill_5_icon: config.custom_pill_5_icon || "mdi:flash",
      custom_pill_5_label: config.custom_pill_5_label || "",
      custom_pill_5_color: config.custom_pill_5_color || [251, 191, 36],
      custom_pill_5_show_label: config.custom_pill_5_show_label !== false,
      custom_pill_5_top: config.custom_pill_5_top ?? 88,
      custom_pill_5_left: config.custom_pill_5_left ?? 40,
      custom_pill_5_scale: config.custom_pill_5_scale ?? 1.0,
      custom_pill_6_entity: config.custom_pill_6_entity || "",
      custom_pill_6_icon: config.custom_pill_6_icon || "mdi:information",
      custom_pill_6_label: config.custom_pill_6_label || "",
      custom_pill_6_color: config.custom_pill_6_color || [244, 114, 182],
      custom_pill_6_show_label: config.custom_pill_6_show_label !== false,
      custom_pill_6_top: config.custom_pill_6_top ?? 88,
      custom_pill_6_left: config.custom_pill_6_left ?? 80,
      custom_pill_6_scale: config.custom_pill_6_scale ?? 1.0,
      custom_pill_7_entity: config.custom_pill_7_entity || "",
      custom_pill_7_icon: config.custom_pill_7_icon || "mdi:home",
      custom_pill_7_label: config.custom_pill_7_label || "",
      custom_pill_7_color: config.custom_pill_7_color || [56, 189, 248],
      custom_pill_7_show_label: config.custom_pill_7_show_label !== false,
      custom_pill_7_top: config.custom_pill_7_top ?? 92,
      custom_pill_7_left: config.custom_pill_7_left ?? 30,
      custom_pill_7_scale: config.custom_pill_7_scale ?? 1.0,
      custom_pill_8_entity: config.custom_pill_8_entity || "",
      custom_pill_8_icon: config.custom_pill_8_icon || "mdi:leaf",
      custom_pill_8_label: config.custom_pill_8_label || "",
      custom_pill_8_color: config.custom_pill_8_color || [52, 211, 153],
      custom_pill_8_show_label: config.custom_pill_8_show_label !== false,
      custom_pill_8_top: config.custom_pill_8_top ?? 92,
      custom_pill_8_left: config.custom_pill_8_left ?? 70,
      custom_pill_8_scale: config.custom_pill_8_scale ?? 1.0
    };
    for (let i = 1; i <= 8; i++) {
      this._config[`custom_pill_${i}_tap_action`] = config[`custom_pill_${i}_tap_action`] || 'more-info';
      this._config[`custom_pill_${i}_navigation_path`] = config[`custom_pill_${i}_navigation_path`] || '';
      this._config[`custom_pill_${i}_service`] = config[`custom_pill_${i}_service`] || '';
      this._config[`custom_pill_${i}_service_data`] = config[`custom_pill_${i}_service_data`] || {};
    }
    PrismEnergyCard._applyOverlayConfig(this._config, config);
    if (this._hass) {
      this.render();
      if (!this._initialized) {
        this._initialized = true;
      }
    }
  }

  set hass(hass) {
    this._hass = hass;
    // Only do full render on first load, then just update values
    if (!this._initialized) {
      this.render();
      this._initialized = true;
      // Update details after render to ensure DOM is ready
      requestAnimationFrame(() => {
      });
    } else {
      this._updateValues();
      this._updateWeatherIfChanged();
    }
  }

  // Check if weather conditions changed and update only weather elements
  _updateWeatherIfChanged() {
    if (!this._config.enable_weather_effects || !this._config.weather_entity) return;
    
    const weatherData = this._getWeatherData();
    // Include cloud coverage in key (rounded to 10% steps to avoid too frequent updates)
    const cloudKey = weatherData.cloudCoverage !== null ? Math.round(weatherData.cloudCoverage / 10) * 10 : 'none';
    const weatherKey = `${weatherData.weatherType}-${weatherData.isNight}-${weatherData.isSunrise}-${weatherData.isSunset}-${cloudKey}`;
    
    // Only update if weather state changed
    if (this._lastWeatherKey === weatherKey) return;
    this._lastWeatherKey = weatherKey;
    
    // Update weather container
    const weatherContainer = this.shadowRoot.querySelector('.weather-container');
    if (weatherContainer) {
      weatherContainer.remove();
    }
    
    const visualContainer = this.shadowRoot.querySelector('.visual-container');
    if (visualContainer) {
      visualContainer.insertAdjacentHTML('afterbegin', this._renderWeatherEffects(weatherData));
      
      // Update night-mode classes
      const houseImg = this.shadowRoot.querySelector('.house-img');
      if (houseImg) {
        houseImg.classList.toggle('night-mode', weatherData.isNight);
      }
      visualContainer.classList.toggle('night-mode', weatherData.isNight);
    }
    
    // Update weather label in header
    const weatherStatus = this.shadowRoot.querySelector('.weather-status');
    if (weatherStatus) {
      const dayNightLabel = this._getDayNightLabel(weatherData.isNight);
      const weatherTypeLabel = this._getWeatherLabel(weatherData);
      weatherStatus.textContent = `${dayNightLabel} - ${weatherTypeLabel}`;
    }
  }

  // Update only the dynamic values without re-rendering (preserves animations)
  _updateValues() {
    if (!this.shadowRoot || !this._hass) return;

    // Use _getStateInWatts for power sensors to handle kW units (e.g. from evcc)
    const solarPower = this._getStateInWatts(this._config.solar_power, 0);
    const gridPowerDisplay = this._getGridPowerDisplay();
    const batterySoc = this._getState(this._config.battery_soc, 0); // SOC is percentage, not power
    const homeConsumption = this._getStateInWatts(this._config.home_consumption, 0);
    const evPower = this._getStateInWatts(this._config.ev_power, 0);
    // Determine states for labels
    const isSolarActive = solarPower > 50;
    const isGridImport = this._isGridImport();
    const isGridExport = this._isGridExport();
    const isBatteryCharging = this._isBatteryCharging();
    const isBatteryDischarging = this._isBatteryDischarging();
    const isEvCharging = evPower > 50;
    const hasBattery = !!this._config.battery_soc;

    // Update pill values
    this._updateElement('.pill-solar .pill-val', this._formatPower(solarPower));
    this._updateElement('.pill-grid .pill-val', this._formatPower(gridPowerDisplay));
    this._updateElement('.pill-home .pill-val', this._formatPower(homeConsumption));
    if (hasBattery) {
      this._updateElement('.pill-battery .pill-val', `${Math.round(batterySoc)}%`);
    }
    
    // Update pill labels dynamically
    this._updateElement('.pill-solar .pill-label', isSolarActive ? this._t('production') : this._t('inactive'));
    this._updateElement('.pill-grid .pill-label', isGridExport ? this._t('export') : isGridImport ? this._t('import') : this._t('neutral'));
    if (hasBattery) {
      this._updateElement('.pill-battery .pill-label', isBatteryCharging ? this._t('charging') : isBatteryDischarging ? this._t('discharging') : this._t('standby'));
    }
    
    // Update pill icon classes (active/inactive states)
    this._updatePillIconClass('.pill-solar .pill-icon', isSolarActive, 'bg-solar');
    this._updatePillIconClass('.pill-solar .pill-icon ha-icon', isSolarActive, 'color-solar');
    this._updatePillIconClass('.pill-grid .pill-icon', isGridImport || isGridExport, 'bg-grid');
    this._updatePillIconClass('.pill-grid .pill-icon ha-icon', isGridImport || isGridExport, 'color-grid');
    if (hasBattery) {
      this._updatePillIconClass('.pill-battery .pill-icon', isBatteryCharging || isBatteryDischarging, 'bg-battery');
      this._updatePillIconClass('.pill-battery .pill-icon ha-icon', isBatteryCharging || isBatteryDischarging, 'color-battery');
    }
    
    if (this._config.ev_power) {
      this._updateElement('.pill-ev .pill-label', this._config.ev_label || 'EV');
      this._updateElement('.pill-ev .pill-val', isEvCharging ? this._formatPower(evPower) : this._t('idle'));
      this._updatePillIconClass('.pill-ev .pill-icon', isEvCharging, 'bg-ev');
      this._updatePillIconClass('.pill-ev .pill-icon ha-icon', isEvCharging, 'color-ev');
    }
    
    // Update Custom Pills
    this._updateCustomPills();

    // Update flow visibility
    this._updateFlows();
    
    // Update details section values
  }
  
  // Helper to toggle active/inactive classes on pill icons
  _updatePillIconClass(selector, isActive, activeClass) {
    const el = this.shadowRoot.querySelector(selector);
    if (!el) return;
    
    const inactiveClass = 'bg-inactive';
    const inactiveColorClass = 'color-inactive';
    
    if (activeClass.startsWith('bg-')) {
      el.classList.toggle(activeClass, isActive);
      el.classList.toggle(inactiveClass, !isActive);
    } else if (activeClass.startsWith('color-')) {
      el.classList.toggle(activeClass, isActive);
      el.classList.toggle(inactiveColorClass, !isActive);
    }
  }

  // Update Custom Pills values
  _updateCustomPills() {
    for (let i = 1; i <= 8; i++) {
      const entity = this._config[`custom_pill_${i}_entity`];
      if (entity) {
        const stateObj = this._hass.states[entity];
        if (stateObj) {
          const value = stateObj.state;
          const unit = stateObj.attributes?.unit_of_measurement || '';
          this._updateElement(`.pill-custom-${i} .pill-val`, `${value}${unit ? ' ' + unit : ''}`);
        }
      }
    }
    this._updateOverlays();
  }

  // Get Custom Pill value with unit
  _getCustomPillValue(entityId) {
    if (!entityId || !this._hass) return { value: '', unit: '' };
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return { value: 'â€”', unit: '' };
    return {
      value: stateObj.state,
      unit: stateObj.attributes?.unit_of_measurement || ''
    };
  }

  // Normalize color from RGB array or hex string
  _normalizeColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      return { r: color[0], g: color[1], b: color[2] };
    }
    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    }
    return { r: 34, g: 211, b: 238 }; // Default cyan
  }


  _getOverlaySettings(prefix) {
    return {
      enabled: this._config[`${prefix}_enabled`],
      top: this._config[`${prefix}_top`],
      left: this._config[`${prefix}_left`],
      scale: this._config[`${prefix}_scale`],
      opacity: this._config[`${prefix}_opacity`],
      color: this._config[`${prefix}_color`],
      icon: this._config[`${prefix}_icon`],
      showIcon: this._config[`${prefix}_show_icon`],
      label: this._config[`${prefix}_label`] || '',
      showLabel: this._config[`${prefix}_show_label`],
      glow: this._config[`${prefix}_glow`] ?? 0,
      angle: this._config[`${prefix}_angle`] ?? 0
    };
  }

  _overlayStyle(top, left, scale, opacity, glow, angle, colorStr) {
    const glowAmount = Math.max(0, Math.min(1, Number(glow) || 0));
    const glowBlur = glowAmount * 28;
    const glowSpread = glowAmount * 6;
    const glowAlpha = 0.15 + glowAmount * 0.65;
    return [
      `top: ${top}%`,
      `left: ${left}%`,
      `--overlay-scale: ${scale}`,
      `--overlay-angle: ${angle ?? 0}deg`,
      `--overlay-glow-blur: ${glowBlur}px`,
      `--overlay-glow-spread: ${glowSpread}px`,
      `--overlay-glow-color: rgba(${colorStr}, ${glowAlpha})`,
      `opacity: ${opacity}`,
      `color: rgb(${colorStr})`
    ].join('; ');
  }

  _buildPowerOverlay({ extraClass, prefix, value, visible }) {
    const s = this._getOverlaySettings(prefix);
    if (!s.enabled) return '';
    const rgb = this._normalizeColor(s.color);
    const colorStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    const style = `${this._overlayStyle(s.top, s.left, s.scale, s.opacity, s.glow, s.angle, colorStr)}; display: ${visible ? 'flex' : 'none'};`;
    const iconHtml = s.showIcon && s.icon
      ? `<ha-icon class="overlay-icon" icon="${s.icon}" style="color: rgb(${colorStr});"></ha-icon>`
      : '';
    const labelHtml = s.showLabel && s.label
      ? `<span class="overlay-label">${s.label}</span>`
      : '';
    return `<div class="power-overlay ${extraClass}" data-overlay="${prefix}" style="${style}"><div class="overlay-inner">${labelHtml}<div class="overlay-row">${iconHtml}<span class="overlay-val">${value}</span></div></div></div>`;
  }

  _getSensorOverlayDisplay(entityId) {
    if (!entityId || !this._hass) return { text: '', visible: false };
    const stateObj = this._hass.states[entityId];
    if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
      return { text: '—', visible: false };
    }
    const unit = stateObj.attributes?.unit_of_measurement || '';
    return { text: `${stateObj.state}${unit ? ' ' + unit : ''}`, visible: true };
  }

  _updatePowerOverlay(selector, value, visible, labelText) {
    const el = this.shadowRoot?.querySelector(selector);
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
    const valEl = el.querySelector('.overlay-val');
    if (valEl && valEl.textContent !== value) {
      valEl.textContent = value;
    }
    if (labelText !== undefined) {
      const labelEl = el.querySelector('.overlay-label');
      if (labelEl && labelEl.textContent !== labelText) {
        labelEl.textContent = labelText;
      }
    }
  }

  _getEntityDisplayState(entityId) {
    if (!entityId || !this._hass) return 'â€”';
    const stateObj = this._hass.states[entityId];
    if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') return 'â€”';
    return stateObj.state;
  }

  _updateOverlays() {
    if (!this.shadowRoot || !this._hass) return;
    const chargeW = this._getBatteryChargeWatts();
    const dischargeW = this._getBatteryDischargeWatts();
    const chargeLabel = this._config.battery_charge_overlay_show_label ? (this._config.battery_charge_overlay_label || '') : undefined;
    const dischargeLabel = this._config.battery_discharge_overlay_show_label ? (this._config.battery_discharge_overlay_label || '') : undefined;

    if (this._config.battery_charge_overlay_enabled) {
      this._updatePowerOverlay('.power-overlay.charge', chargeW > 0 ? this._formatPower(chargeW) : '', chargeW > 0, chargeLabel);
    }
    if (this._config.battery_discharge_overlay_enabled) {
      this._updatePowerOverlay('.power-overlay.discharge', dischargeW > 0 ? this._formatPower(dischargeW) : '', dischargeW > 0, dischargeLabel);
    }
    if (this._config.ev_soc_overlay_enabled && this._config.ev_soc_entity) {
      const socVal = this._getState(this._config.ev_soc_entity, NaN);
      const show = !isNaN(socVal) && socVal > 0;
      const evLabel = this._config.ev_soc_overlay_show_label ? (this._config.ev_soc_overlay_label || '') : undefined;
      this._updatePowerOverlay('.power-overlay.ev-soc', show ? `${Math.round(socVal)}%` : '', show, evLabel);
    }
    if (this._config.inverter_temp_overlay_enabled && this._config.inverter_temp_overlay_entity) {
      const inv = this._getSensorOverlayDisplay(this._config.inverter_temp_overlay_entity);
      const invLabel = this._config.inverter_temp_overlay_show_label ? (this._config.inverter_temp_overlay_label || '') : undefined;
      this._updatePowerOverlay('.power-overlay.inverter-temp', inv.text, inv.visible, invLabel);
    }
    if (this._config.battery_temp_overlay_enabled && this._config.battery_temp_overlay_entity) {
      const bat = this._getSensorOverlayDisplay(this._config.battery_temp_overlay_entity);
      const batLabel = this._config.battery_temp_overlay_show_label ? (this._config.battery_temp_overlay_label || '') : undefined;
      this._updatePowerOverlay('.power-overlay.battery-temp', bat.text, bat.visible, batLabel);
    }
    if (this._config.tesla_connected_overlay_enabled && this._config.tesla_connected_overlay_entity) {
      const tesla = this._getSensorOverlayDisplay(this._config.tesla_connected_overlay_entity);
      const teslaLabel = this._config.tesla_connected_overlay_show_label ? (this._config.tesla_connected_overlay_label || '') : undefined;
      this._updatePowerOverlay('.power-overlay.tesla-connected', tesla.text, tesla.visible, teslaLabel);
    }
    if (this._config.status_entity) {
      this._updateElement('.pill-status .pill-val', this._getEntityDisplayState(this._config.status_entity));
    }
  }

  _renderAllOverlays() {
    let html = '';
    if (this._config.battery_soc) {
      const chargeW = this._getBatteryChargeWatts();
      const dischargeW = this._getBatteryDischargeWatts();
      html += this._buildPowerOverlay({
        extraClass: 'charge',
        prefix: 'battery_charge_overlay',
        value: chargeW > 0 ? this._formatPower(chargeW) : '',
        visible: chargeW > 0
      });
      html += this._buildPowerOverlay({
        extraClass: 'discharge',
        prefix: 'battery_discharge_overlay',
        value: dischargeW > 0 ? this._formatPower(dischargeW) : '',
        visible: dischargeW > 0
      });
    }
    if (this._config.ev_soc_entity && this._config.ev_power) {
      const socVal = this._getState(this._config.ev_soc_entity, 0);
      const show = socVal > 0;
      html += this._buildPowerOverlay({
        extraClass: 'ev-soc',
        prefix: 'ev_soc_overlay',
        value: show ? `${Math.round(socVal)}%` : '',
        visible: show
      });
    }
    if (this._config.inverter_temp_overlay_entity) {
      const inv = this._getSensorOverlayDisplay(this._config.inverter_temp_overlay_entity);
      html += this._buildPowerOverlay({
        extraClass: 'inverter-temp',
        prefix: 'inverter_temp_overlay',
        value: inv.text,
        visible: inv.visible
      });
    }
    if (this._config.battery_temp_overlay_entity) {
      const bat = this._getSensorOverlayDisplay(this._config.battery_temp_overlay_entity);
      html += this._buildPowerOverlay({
        extraClass: 'battery-temp',
        prefix: 'battery_temp_overlay',
        value: bat.text,
        visible: bat.visible
      });
    }
    if (this._config.tesla_connected_overlay_entity) {
      const tesla = this._getSensorOverlayDisplay(this._config.tesla_connected_overlay_entity);
      html += this._buildPowerOverlay({
        extraClass: 'tesla-connected',
        prefix: 'tesla_connected_overlay',
        value: tesla.text,
        visible: tesla.visible
      });
    }
    return html;
  }

  _renderStatusPill() {
    const entity = this._config.status_entity;
    if (!entity) return '';
    const icon = this._config.status_icon || 'mdi:battery-sync';
    const label = this._config.status_label || '';
    const showLabel = this._config.status_show_label;
    const top = this._config.status_pill_top ?? 12;
    const left = this._config.status_pill_left ?? 78;
    const scale = this._config.status_pill_scale ?? 1.0;
    const displayState = this._getEntityDisplayState(entity);
    return `
      <div class="pill pill-status" style="top: ${top}%; left: ${left}%; --pill-scale: ${scale};" data-entity="${entity}">
        <div class="pill-icon bg-status"><ha-icon icon="${icon}" class="color-status"></ha-icon></div>
        <div class="pill-content">
          <span class="pill-val">${displayState}</span>
          ${showLabel && label ? `<span class="pill-label">${label}</span>` : ''}
        </div>
      </div>
    `;
  }
  // Render Custom Pills HTML
  _renderCustomPills() {
    let html = '';
    
    for (let i = 1; i <= 8; i++) {
      const entity = this._config[`custom_pill_${i}_entity`];
      if (!entity) continue;
      
      const icon = this._config[`custom_pill_${i}_icon`] || 'mdi:information';
      const label = this._config[`custom_pill_${i}_label`] || '';
      const colorConfig = this._config[`custom_pill_${i}_color`];
      const showLabel = this._config[`custom_pill_${i}_show_label`] !== false;
      const top = this._config[`custom_pill_${i}_top`] ?? 85;
      const left = this._config[`custom_pill_${i}_left`] ?? (35 + (i - 1) * 15);
      const scale = this._config[`custom_pill_${i}_scale`] ?? 1.0;
      
      // Get color as RGB
      const color = this._normalizeColor(colorConfig);
      const colorStr = `${color.r}, ${color.g}, ${color.b}`;
      
      // Get entity value
      const { value, unit } = this._getCustomPillValue(entity);
      const displayValue = value + (unit ? ' ' + unit : '');
      
      html += `
          <div class="pill pill-custom-${i}" style="top: ${top}%; left: ${left}%; --pill-scale: ${scale};" data-entity="${entity}" data-custom-pill="${i}">
            <div class="pill-icon" style="background: rgba(${colorStr}, 0.15); box-shadow: 0 0 8px rgba(${colorStr}, 0.3);">
              <ha-icon icon="${icon}" style="color: rgb(${colorStr});"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${displayValue}</span>
              ${showLabel && label ? `<span class="pill-label">${label}</span>` : ''}
            </div>
          </div>
      `;
    }
    
    return html;
  }
  
  _updateElement(selector, value) {
    const el = this.shadowRoot.querySelector(selector);
    if (el && el.textContent !== value) {
      el.textContent = value;
    }
  }

  _updateFlows() {
    // Use _getStateInWatts for power sensors to handle kW units (e.g. from evcc)
    const solarPower = this._getStateInWatts(this._config.solar_power, 0);
    const homeConsumption = this._getStateInWatts(this._config.home_consumption, 0);
    const evPower = this._getStateInWatts(this._config.ev_power, 0);

    const isSolarActive = solarPower > 50;
    const isGridImport = this._isGridImport();
    const isGridExport = this._isGridExport();
    const isBatteryCharging = this._isBatteryCharging();
    const isBatteryDischarging = this._isBatteryDischarging();
    const isEvCharging = evPower > 50;
    const hasEV = !!this._config.ev_power;
    const hasBattery = !!this._config.battery_soc;

    // Show/hide flow groups based on state
    this._setFlowVisibility('flow-solar-home', isSolarActive && homeConsumption > 0);
    this._setFlowVisibility('flow-solar-battery', hasBattery && isSolarActive && isBatteryCharging);
    this._setFlowVisibility('flow-solar-grid', isSolarActive && isGridExport);
    this._setFlowVisibility('flow-grid-home', isGridImport);
    this._setFlowVisibility('flow-grid-battery', hasBattery && isGridImport && isBatteryCharging);
    this._setFlowVisibility('flow-battery-home', hasBattery && isBatteryDischarging);
    this._setFlowVisibility('flow-battery-grid', hasBattery && isBatteryDischarging && isGridExport);
    
    if (hasEV) {
      // EV is treated as sub-load of home - only one line from home to EV
      this._setFlowVisibility('flow-home-ev', isEvCharging);
    }
  }

  _setFlowVisibility(className, visible) {
    const el = this.shadowRoot.querySelector(`.${className}`);
    if (el) {
      el.style.display = visible ? 'block' : 'none';
    }
  }

  getCardSize() {
    return 6;
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();
  }

  disconnectedCallback() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
    this._listenersAttached = false;
  }

  // Open more-info dialog for an entity (shows history)
  _openMoreInfo(entityId) {
    if (!entityId || !this._hass) return;
    
    // Use CustomEvent (not Event) to properly pass detail through Shadow DOM boundaries
    const event = new CustomEvent('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: { entityId: entityId }
    });
    this.dispatchEvent(event);
  }

  _navigate(path) {
    if (!path) return;
    const event = new CustomEvent('hass-navigate', {
      bubbles: true,
      composed: true,
      detail: { path }
    });
    this.dispatchEvent(event);
    history.pushState(null, '', path);
    window.dispatchEvent(new Event('location-changed'));
  }

  _callService(domain, service, serviceData = {}) {
    if (!this._hass?.callService) return Promise.resolve();
    const data = { ...serviceData };
    return this._hass.callService(domain, service, data).catch((err) => {
      console.warn('[prism-energy] Service call failed:', domain, service, data, err);
    });
  }

  _getCustomPillTapAction(index) {
    let action = this._config[`custom_pill_${index}_tap_action`] || 'more-info';
    if (typeof action === 'object' && action?.action) {
      action = action.action;
    }
    return action;
  }

  _toggleEntity(entityId) {
    if (!entityId || !this._hass) return;
    const domain = entityId.split('.')[0];
    const entity = this._hass.states[entityId];
    const state = entity?.state ?? 'off';

    if (domain === 'lock') {
      this._callService('lock', state === 'locked' ? 'unlock' : 'lock', { entity_id: entityId });
    } else if (domain === 'cover') {
      this._callService('cover', (state === 'open' || state === 'opening') ? 'close_cover' : 'open_cover', { entity_id: entityId });
    } else if (domain === 'scene' || domain === 'script') {
      this._callService(domain, 'turn_on', { entity_id: entityId });
    } else if (domain === 'automation') {
      this._callService('automation', state === 'on' ? 'turn_off' : 'turn_on', { entity_id: entityId });
    } else if (['light', 'switch', 'fan', 'input_boolean'].includes(domain)) {
      this._callService(domain, 'toggle', { entity_id: entityId });
    } else if (this._hass.services?.[domain]?.toggle) {
      this._callService(domain, 'toggle', { entity_id: entityId });
    } else if (state === 'on') {
      this._callService(domain, 'turn_off', { entity_id: entityId });
    } else {
      this._callService(domain, 'turn_on', { entity_id: entityId });
    }
  }

  _executeCustomPillAction(index) {
    if (!this._hass) return;
    const action = this._getCustomPillTapAction(index);
    const entity = this._config[`custom_pill_${index}_entity`];

    if (action === 'none') return;
    if (action === 'toggle') {
      if (entity) this._toggleEntity(entity);
      return;
    }
    if (action === 'more-info') {
      if (entity) this._openMoreInfo(entity);
      return;
    }
    if (action === 'navigate') {
      this._navigate(this._config[`custom_pill_${index}_navigation_path`]);
      return;
    }
    if (action === 'call-service') {
      const serviceConfig = this._config[`custom_pill_${index}_service`];
      if (!serviceConfig) return;
      const [domain, service] = serviceConfig.split('.');
      if (!domain || !service) return;
      const serviceData = { ...(this._config[`custom_pill_${index}_service_data`] || {}) };
      if (entity && !serviceData.entity_id) {
        serviceData.entity_id = entity;
      }
      this._callService(domain, service, serviceData);
    }
  }

  // Setup click event listeners for pills (delegated so config re-renders stay wired)
  _setupEventListeners() {
    if (!this.shadowRoot || this._listenersAttached) return;
    this._listenersAttached = true;

    this.shadowRoot.addEventListener('click', (e) => {
      const customPill = e.target.closest('.pill[data-custom-pill]');
      if (customPill) {
        e.stopPropagation();
        const index = parseInt(customPill.getAttribute('data-custom-pill'), 10);
        if (!isNaN(index)) {
          this._executeCustomPillAction(index);
        }
        return;
      }

      const pill = e.target.closest('.pill[data-entity]:not([data-custom-pill])');
      if (pill) {
        e.stopPropagation();
        const entityId = pill.getAttribute('data-entity');
        if (entityId) {
          this._openMoreInfo(entityId);
        }
        return;
      }

      const houseImg = e.target.closest('.house-img');
      if (houseImg && this._config.home_consumption) {
        this._openMoreInfo(this._config.home_consumption);
      }
    });
  }

  // Helper to get entity state
  _getState(entityId, defaultVal = 0) {
    if (!entityId || !this._hass) return defaultVal;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return defaultVal;
    const val = parseFloat(stateObj.state);
    return isNaN(val) ? defaultVal : val;
  }

  // Helper to get power entity state normalized to Watts
  // Handles entities that report in kW (like evcc) and converts them to W
  _getStateInWatts(entityId, defaultVal = 0) {
    if (!entityId || !this._hass) return defaultVal;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return defaultVal;
    const val = parseFloat(stateObj.state);
    if (isNaN(val)) return defaultVal;
    
    // Check unit of measurement and convert kW to W if needed
    const unit = stateObj.attributes?.unit_of_measurement?.toLowerCase() || '';
    if (unit === 'kw') {
      return val * 1000; // Convert kW to W
    }
    return val;
  }

  _usesSplitGridSensors() {
    return !!(this._config.grid_import || this._config.grid_export);
  }

  _usesSplitBatteryPowerSensors() {
    return !!(this._config.battery_charge || this._config.battery_discharge);
  }

  _getGridImportWatts() {
    if (this._usesSplitGridSensors()) {
      return this._getStateInWatts(this._config.grid_import, 0);
    }
    const gridPower = this._getStateInWatts(this._config.grid_power, 0);
    return gridPower > 0 ? gridPower : 0;
  }

  _getGridExportWatts() {
    if (this._usesSplitGridSensors()) {
      return this._getStateInWatts(this._config.grid_export, 0);
    }
    const gridPower = this._getStateInWatts(this._config.grid_power, 0);
    return gridPower < 0 ? Math.abs(gridPower) : 0;
  }

  _getGridPowerSigned() {
    if (this._usesSplitGridSensors()) {
      const importW = this._getGridImportWatts();
      const exportW = this._getGridExportWatts();
      if (importW > 50) return importW;
      if (exportW > 50) return -exportW;
      return 0;
    }
    return this._getStateInWatts(this._config.grid_power, 0);
  }

  _getGridPowerDisplay() {
    const importW = this._getGridImportWatts();
    const exportW = this._getGridExportWatts();
    if (exportW > 50) return exportW;
    if (importW > 50) return importW;
    if (this._usesSplitGridSensors()) return Math.max(importW, exportW);
    return Math.abs(this._getGridPowerSigned());
  }

  _isGridImport() {
    if (this._usesSplitGridSensors()) {
      return this._getGridImportWatts() > 50;
    }
    return this._getGridPowerSigned() > 50;
  }

  _isGridExport() {
    if (this._usesSplitGridSensors()) {
      return this._getGridExportWatts() > 50;
    }
    return this._getGridPowerSigned() < -50;
  }

  _getGridPillEntity() {
    if (this._usesSplitGridSensors()) {
      if (this._isGridImport()) return this._config.grid_import;
      if (this._isGridExport()) return this._config.grid_export;
      return this._config.grid_import || this._config.grid_export;
    }
    return this._config.grid_power;
  }

  _getBatteryChargeWatts() {
    if (this._usesSplitBatteryPowerSensors()) {
      return this._getStateInWatts(this._config.battery_charge, 0);
    }
    const batteryPower = this._getStateInWatts(this._config.battery_power, 0);
    return batteryPower < 0 ? Math.abs(batteryPower) : 0;
  }

  _getBatteryDischargeWatts() {
    if (this._usesSplitBatteryPowerSensors()) {
      return this._getStateInWatts(this._config.battery_discharge, 0);
    }
    const batteryPower = this._getStateInWatts(this._config.battery_power, 0);
    return batteryPower > 0 ? batteryPower : 0;
  }

  _getBatteryPowerSigned() {
    if (this._usesSplitBatteryPowerSensors()) {
      const chargeW = this._getBatteryChargeWatts();
      const dischargeW = this._getBatteryDischargeWatts();
      if (dischargeW > 50) return dischargeW;
      if (chargeW > 50) return -chargeW;
      return 0;
    }
    return this._getStateInWatts(this._config.battery_power, 0);
  }

  _getBatteryPowerDisplay() {
    const chargeW = this._getBatteryChargeWatts();
    const dischargeW = this._getBatteryDischargeWatts();
    if (this._usesSplitBatteryPowerSensors()) {
      if (dischargeW > 50) return dischargeW;
      if (chargeW > 50) return chargeW;
      return Math.max(chargeW, dischargeW);
    }
    return Math.abs(this._getBatteryPowerSigned());
  }

  _isBatteryCharging() {
    if (this._usesSplitBatteryPowerSensors()) {
      return this._getBatteryChargeWatts() > 50;
    }
    return this._getBatteryPowerSigned() < -50;
  }

  _isBatteryDischarging() {
    if (this._usesSplitBatteryPowerSensors()) {
      return this._getBatteryDischargeWatts() > 50;
    }
    return this._getBatteryPowerSigned() > 50;
  }

  // Helper to format power values
  _formatPower(watts) {
    const absWatts = Math.abs(watts);
    if (absWatts >= 1000) {
      return `${(absWatts / 1000).toFixed(1)} kW`;
    }
    return `${Math.round(absWatts)} W`;
  }

  // Generate animated flow path with real SVG filter glow (CodePen style)
  _renderFlow(path, color, active, reverse = false, className = '') {
    const direction = reverse ? 'reverse' : '';
    const display = active ? 'block' : 'none';
    // Create unique filter ID based on color
    const filterId = `glow-${color.replace('#', '').replace(/[^a-zA-Z0-9]/g, '')}`;
    
    return `
      <g class="flow-group ${className}" style="display: ${display};">
        <!-- Background track (pulsing, async) -->
        <path d="${path}" fill="none" stroke="${color}" stroke-width="0.5" stroke-linecap="round" class="flow-track" />
        
        <!-- Glowing animated beam with SVG filter -->
        <path d="${path}" fill="none" stroke="${color}" stroke-width="1.2" stroke-opacity="0.9" stroke-linecap="round" 
              class="flow-beam ${direction}" filter="url(#strokeGlow)" />
        
        <!-- Bright core with soft edges -->
        <path d="${path}" fill="none" stroke="${color}" stroke-width="0.5" stroke-opacity="0.85" stroke-linecap="round" 
              class="flow-beam ${direction}" filter="url(#softEdge)" />
      </g>
    `;
  }

  // Get weather icon based on conditions
  _getWeatherIcon(weatherData) {
    if (!weatherData.enabled) return 'mdi:weather-sunny';
    
    const { weatherType, isNight } = weatherData;
    
    if (isNight) {
      if (weatherType === 'cloudy') return 'mdi:weather-night-partly-cloudy';
      if (weatherType === 'rainy') return 'mdi:weather-rainy';
      if (weatherType === 'snowy') return 'mdi:weather-snowy';
      if (weatherType === 'foggy') return 'mdi:weather-fog';
      if (weatherType === 'stormy') return 'mdi:weather-lightning';
      return 'mdi:weather-night';
    } else {
      if (weatherType === 'cloudy') return 'mdi:weather-partly-cloudy';
      if (weatherType === 'rainy') return 'mdi:weather-rainy';
      if (weatherType === 'snowy') return 'mdi:weather-snowy';
      if (weatherType === 'foggy') return 'mdi:weather-fog';
      if (weatherType === 'stormy') return 'mdi:weather-lightning';
      if (weatherType === 'windy') return 'mdi:weather-windy';
      return 'mdi:weather-sunny';
    }
  }

  // Get weather label for display (supports EN/DE based on HA language)
  _getWeatherLabel(weatherData) {
    if (!weatherData.enabled) return '';
    
    // Check Home Assistant language
    const lang = this._hass?.language || this._hass?.locale?.language || 'en';
    const isGerman = lang.startsWith('de');
    
    const labels = isGerman ? {
      'sunny': 'Sonnig',
      'clear': 'Klar',
      'cloudy': 'BewÃ¶lkt',
      'rainy': 'Regen',
      'snowy': 'Schnee',
      'foggy': 'Nebel',
      'stormy': 'Gewitter',
      'windy': 'Windig'
    } : {
      'sunny': 'Sunny',
      'clear': 'Clear',
      'cloudy': 'Cloudy',
      'rainy': 'Rain',
      'snowy': 'Snow',
      'foggy': 'Fog',
      'stormy': 'Storm',
      'windy': 'Windy'
    };
    
    return labels[weatherData.weatherType] || weatherData.weatherType;
  }

  // Get day/night label based on HA language
  _getDayNightLabel(isNight) {
    const lang = this._hass?.language || this._hass?.locale?.language || 'en';
    const isGerman = lang.startsWith('de');
    
    if (isGerman) {
      return isNight ? 'Nacht' : 'Tag';
    }
    return isNight ? 'Night' : 'Day';
  }

  // Translate UI labels based on HA language (card display only, not editor)
  _t(key) {
    const lang = this._hass?.language || this._hass?.locale?.language || 'en';
    const isGerman = lang.startsWith('de');
    
    const translations = {
      // Pill labels
      'production': isGerman ? 'Erzeugung' : 'Production',
      'inactive': isGerman ? 'Inaktiv' : 'Inactive',
      'export': isGerman ? 'Einspeisung' : 'Export',
      'import': isGerman ? 'Bezug' : 'Import',
      'neutral': isGerman ? 'Neutral' : 'Neutral',
      'consumption': isGerman ? 'Verbrauch' : 'Consumption',
      'charging': isGerman ? 'Ladung' : 'Charging',
      'discharging': isGerman ? 'Entladung' : 'Discharging',
      'standby': isGerman ? 'Standby' : 'Standby',
      'idle': isGerman ? 'Inaktiv' : 'Idle',
      // Detail headers
      'grid': isGerman ? 'Netz' : 'Grid',
      'storage': isGerman ? 'Speicher' : 'Storage',
      'current': isGerman ? 'Aktuell' : 'Current',
      // Detail labels
      'power': isGerman ? 'Leistung' : 'Power',
      'autarky': isGerman ? 'Autarkie' : 'Autarky',
      // Module defaults
      'module': isGerman ? 'Modul' : 'Module',
      // Live indicator
      'live': 'LIVE'
    };
    
    return translations[key] || key;
  }

  // Get weather data from Home Assistant
  _getWeatherData() {
    if (!this._config.enable_weather_effects || !this._config.weather_entity || !this._hass) {
      return { enabled: false };
    }

    // Get weather state
    const weatherState = this._hass.states[this._config.weather_entity];
    const weatherCondition = (weatherState?.state || 'clear').toLowerCase();

    // Get sun state for day/night
    const sunState = this._hass.states['sun.sun'];
    const isNight = sunState?.state === 'below_horizon';
    
    // Get sun elevation for sunrise/sunset effects
    const sunElevation = sunState?.attributes?.elevation || 0;
    const isSunrise = sunElevation > -10 && sunElevation < 10 && !isNight;
    const isSunset = sunElevation > -10 && sunElevation < 10 && isNight;

    // Map HA weather states to animation types
    let weatherType = 'clear';
    if (weatherCondition.includes('rain') || weatherCondition.includes('drizzle') || weatherCondition.includes('shower')) {
      weatherType = 'rainy';
    } else if (weatherCondition.includes('snow') || weatherCondition.includes('sleet') || weatherCondition.includes('hail')) {
      weatherType = 'snowy';
    } else if (weatherCondition.includes('fog') || weatherCondition.includes('mist') || weatherCondition.includes('haze')) {
      weatherType = 'foggy';
    } else if (weatherCondition.includes('cloud') || weatherCondition.includes('overcast')) {
      weatherType = 'cloudy';
    } else if (weatherCondition.includes('clear') || weatherCondition.includes('sunny')) {
      weatherType = 'sunny';
    } else if (weatherCondition.includes('thunder') || weatherCondition.includes('lightning')) {
      weatherType = 'stormy';
    } else if (weatherCondition.includes('wind')) {
      weatherType = 'windy';
    }

    // Get cloud coverage from optional sensor (0-100%)
    let cloudCoverage = null;
    if (this._config.cloud_coverage_entity) {
      const cloudState = this._hass.states[this._config.cloud_coverage_entity];
      if (cloudState) {
        cloudCoverage = parseFloat(cloudState.state) || 0;
      }
    }

    return {
      enabled: true,
      weatherType,
      isNight,
      isSunrise,
      isSunset,
      condition: weatherCondition,
      cloudCoverage
    };
  }

  // Render weather effects HTML
  _renderWeatherEffects(weatherData) {
    if (!weatherData.enabled) return '';

    let html = '<div class="weather-container">';
    const { weatherType, isNight, isSunrise, isSunset } = weatherData;

    // Rain effect (optimized for mobile performance)
    if (weatherType === 'rainy' || weatherType === 'stormy') {
      const dropCount = weatherType === 'stormy' ? 25 : 15;
      for (let i = 0; i < dropCount; i++) {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 0.6 + Math.random() * 0.4;
        html += `<div class="rain-drop" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s;"></div>`;
      }
    }

    // Snow effect (optimized for mobile performance)
    if (weatherType === 'snowy') {
      for (let i = 0; i < 25; i++) {
        const left = Math.random() * 100;
        const delay = Math.random() * 6;
        const duration = 5 + Math.random() * 5;
        const size = 3 + Math.random() * 3;
        html += `<div class="snow-flake" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s; width: ${size}px; height: ${size}px;"></div>`;
      }
    }

    // Fog effect
    if (weatherType === 'foggy') {
      html += `<div class="fog-layer fog-1"></div>`;
      html += `<div class="fog-layer fog-2"></div>`;
      html += `<div class="fog-layer fog-3"></div>`;
    }

    // Lightning effect for storms
    if (weatherType === 'stormy') {
      html += `<div class="lightning"></div>`;
    }

    // Night effects: stars and moon
    if (isNight) {
      // Stars - only in top 15-20% of the card
      html += '<div class="stars-container">';
      for (let i = 0; i < 20; i++) {
        const left = Math.random() * 100;
        const top = Math.random() * 18; // Only top 18%
        const size = 1 + Math.random() * 1.5;
        const delay = Math.random() * 3;
        const brightness = 0.2 + Math.random() * 0.3; // More transparent (0.2-0.5)
        html += `<div class="star" style="left: ${left}%; top: ${top}%; width: ${size}px; height: ${size}px; animation-delay: ${delay}s; opacity: ${brightness};"></div>`;
      }
      html += '</div>';

      // Moon (only if not completely cloudy) - more subtle
      if (weatherType !== 'foggy' && weatherType !== 'stormy') {
        html += `
          <div class="moon">
            <div class="moon-crater c1"></div>
            <div class="moon-crater c2"></div>
            <div class="moon-crater c3"></div>
          </div>
        `;
      }
    } else {
      // Day effects: sun glow - more subtle
      if (weatherType === 'sunny' || weatherType === 'clear') {
        html += '<div class="sun-glow"></div>';
      }
    }

    // Sunrise/Sunset gradient overlay
    if (isSunrise) {
      html += '<div class="sunrise-overlay"></div>';
    } else if (isSunset) {
      html += '<div class="sunset-overlay"></div>';
    }

    // Clouds based on cloud coverage or weather type
    const cloudCoverage = weatherData.cloudCoverage;
    const showClouds = (weatherType === 'cloudy' || (cloudCoverage !== null && cloudCoverage > 0)) && 
                       weatherType !== 'foggy' && !isNight;
    
    if (showClouds) {
      // Determine cloud count based on coverage (if available) or default to all
      let staticCount = 3;
      let movingCount = 4;
      
      if (cloudCoverage !== null) {
        // Scale clouds based on coverage percentage
        if (cloudCoverage <= 20) {
          staticCount = 0; movingCount = 1;
        } else if (cloudCoverage <= 40) {
          staticCount = 1; movingCount = 1;
        } else if (cloudCoverage <= 55) {
          staticCount = 2; movingCount = 2;
        } else if (cloudCoverage <= 70) {
          staticCount = 2; movingCount = 3;
        } else if (cloudCoverage <= 85) {
          staticCount = 3; movingCount = 3;
        } else {
          staticCount = 3; movingCount = 4;
        }
      }
      
      html += '<!-- Clouds based on coverage -->';
      // Static clouds
      if (staticCount >= 1) html += '<div class="cloud cloud-static cloud-static-1"></div>';
      if (staticCount >= 2) html += '<div class="cloud cloud-static cloud-static-2"></div>';
      if (staticCount >= 3) html += '<div class="cloud cloud-static cloud-static-3"></div>';
      // Moving clouds
      if (movingCount >= 1) html += '<div class="cloud cloud-moving cloud-1"></div>';
      if (movingCount >= 2) html += '<div class="cloud cloud-moving cloud-2"></div>';
      if (movingCount >= 3) html += '<div class="cloud cloud-moving cloud-3"></div>';
      if (movingCount >= 4) html += '<div class="cloud cloud-moving cloud-4"></div>';
    }

    html += '</div>';
    return html;
  }

  // Get weather-related CSS styles
  _getWeatherStyles() {
    return `
      /* Weather Container - between house image and UI elements */
      .weather-container {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
        border-radius: 24px;
      }

      /* Rain Animation (optimized for mobile performance) */
      .rain-drop {
        position: absolute;
        width: 2px;
        height: 20px;
        background: linear-gradient(to bottom, transparent, rgba(174, 194, 224, 0.6), rgba(174, 194, 224, 0.8));
        top: 0;
        border-radius: 0 0 2px 2px;
        opacity: 0;
        /* GPU acceleration */
        will-change: transform, opacity;
        contain: layout style paint;
        animation: rain-fall linear infinite;
      }
      @keyframes rain-fall {
        0% { transform: translateY(-30px); opacity: 0; }
        5% { opacity: 0.7; }
        95% { opacity: 0.7; }
        100% { transform: translateY(100vh); opacity: 0; }
      }

      /* Snow Animation (optimized for mobile performance) */
      .snow-flake {
        position: absolute;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        top: 0;
        opacity: 0;
        /* GPU acceleration */
        will-change: transform, opacity;
        contain: layout style paint;
        animation: snow-fall linear infinite;
        /* Glow effect kept for visual appeal */
        box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
      }
      @keyframes snow-fall {
        0% { 
          transform: translateY(-10px) translateX(0); 
          opacity: 0; 
        }
        5% { opacity: 0.7; }
        50% { transform: translateY(50vh) translateX(20px); }
        95% { opacity: 0.7; }
        100% { 
          transform: translateY(100vh) translateX(-20px); 
          opacity: 0; 
        }
      }

      /* Fog Animation */
      .fog-layer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg, 
          transparent 0%, 
          rgba(200, 210, 220, 0.15) 20%, 
          rgba(200, 210, 220, 0.25) 50%, 
          rgba(200, 210, 220, 0.15) 80%, 
          transparent 100%
        );
        animation: fog-drift linear infinite;
        filter: blur(30px);
      }
      .fog-1 { animation-duration: 25s; }
      .fog-2 { animation-duration: 35s; animation-direction: reverse; opacity: 0.7; }
      .fog-3 { animation-duration: 45s; animation-delay: -10s; opacity: 0.5; top: 30%; }
      @keyframes fog-drift {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      /* Stars Animation - subtle, only in top area */
      .stars-container {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }
      .star {
        position: absolute;
        background: radial-gradient(circle at center, rgba(255, 255, 255, 0.8), rgba(170, 204, 255, 0.5));
        border-radius: 50%;
        animation: star-twinkle 4s ease-in-out infinite;
        box-shadow: 0 0 3px rgba(255, 255, 255, 0.3);
      }
      @keyframes star-twinkle {
        0%, 100% { opacity: 0.2; transform: scale(0.9); }
        50% { opacity: 0.5; transform: scale(1.1); }
      }

      /* Moon - subtle and transparent, positioned below autarky badge */
      .moon {
        position: absolute;
        top: 50px;
        right: 60px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(245, 245, 245, 0.5) 0%, rgba(232, 232, 232, 0.4) 50%, rgba(208, 208, 208, 0.3) 100%);
        box-shadow: 
          0 0 15px rgba(255, 255, 255, 0.15),
          0 0 30px rgba(255, 255, 255, 0.08);
        z-index: 0;
        opacity: 0.6;
      }
      .moon-crater {
        position: absolute;
        background: radial-gradient(circle at 60% 40%, rgba(180, 180, 180, 0.3), rgba(160, 160, 160, 0.4));
        border-radius: 50%;
        box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.15);
      }
      .moon-crater.c1 { width: 10px; height: 10px; top: 6px; right: 8px; }
      .moon-crater.c2 { width: 6px; height: 6px; bottom: 10px; left: 10px; }
      .moon-crater.c3 { width: 5px; height: 5px; top: 16px; left: 6px; }

      /* Sun Glow - subtle, positioned in top area */
      .sun-glow {
        position: absolute;
        top: 50px;
        right: 100px;
        width: 150px;
        height: 150px;
        background: radial-gradient(
          circle at center,
          rgba(255, 200, 50, 0.2) 0%,
          rgba(255, 180, 50, 0.1) 30%,
          rgba(255, 160, 50, 0.05) 50%,
          transparent 70%
        );
        filter: blur(25px);
        z-index: 0;
        animation: sun-pulse 10s ease-in-out infinite;
      }
      @keyframes sun-pulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.05); opacity: 0.8; }
      }

      /* Sunrise/Sunset Overlays - subtle gradients, below UI */
      .sunrise-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to top,
          rgba(255, 150, 80, 0.08) 0%,
          rgba(255, 180, 100, 0.05) 20%,
          transparent 50%
        );
        z-index: 0;
        pointer-events: none;
      }
      .sunset-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to top,
          rgba(255, 100, 50, 0.1) 0%,
          rgba(255, 80, 80, 0.08) 15%,
          rgba(180, 80, 120, 0.05) 35%,
          transparent 60%
        );
        z-index: 0;
        pointer-events: none;
      }

      /* Lightning Effect - below UI elements */
      .lightning {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0);
        animation: lightning-flash 8s infinite;
        z-index: 0;
        pointer-events: none;
      }
      @keyframes lightning-flash {
        0%, 89%, 91%, 93%, 100% { background: rgba(255, 255, 255, 0); }
        90%, 92% { background: rgba(255, 255, 255, 0.3); }
      }

      /* Clouds - subtle, only in top area, below UI */
      .cloud {
        position: absolute;
        background: linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0.3) 0%,
          rgba(220, 220, 230, 0.2) 100%
        );
        border-radius: 50px;
        filter: blur(3px);
        z-index: 0;
      }
      .cloud::before, .cloud::after {
        content: '';
        position: absolute;
        background: inherit;
        border-radius: 50%;
      }
      .cloud-1 {
        width: 60px; height: 22px;
        top: 8%; left: -80px;
        animation-duration: 50s;
        opacity: 0.4;
      }
      .cloud-1::before { width: 30px; height: 30px; top: -15px; left: 12px; }
      .cloud-1::after { width: 35px; height: 35px; top: -18px; left: 28px; }
      .cloud-2 {
        width: 45px; height: 18px;
        top: 12%; left: -60px;
        animation-duration: 65s;
        animation-delay: -20s;
        opacity: 0.3;
      }
      .cloud-2::before { width: 22px; height: 22px; top: -12px; left: 8px; }
      .cloud-2::after { width: 28px; height: 28px; top: -14px; left: 20px; }
      .cloud-3 {
        width: 70px; height: 25px;
        top: 5%; left: -90px;
        animation-duration: 80s;
        animation-delay: -35s;
        opacity: 0.25;
      }
      .cloud-3::before { width: 35px; height: 35px; top: -18px; left: 15px; }
      .cloud-3::after { width: 42px; height: 42px; top: -22px; left: 35px; }
      .cloud-4 {
        width: 50px; height: 18px;
        top: 16%; left: -70px;
        animation-duration: 60s;
        animation-delay: -15s;
        opacity: 0.32;
      }
      .cloud-4::before { width: 25px; height: 25px; top: -12px; left: 10px; }
      .cloud-4::after { width: 30px; height: 30px; top: -15px; left: 24px; }
      
      /* Static clouds - gently float in place */
      .cloud-static {
        animation: cloud-float 8s ease-in-out infinite;
      }
      .cloud-static-1 {
        width: 55px; height: 20px;
        top: 15%; left: 25%;
        opacity: 0.35;
      }
      .cloud-static-1::before { width: 28px; height: 28px; top: -14px; left: 10px; }
      .cloud-static-1::after { width: 32px; height: 32px; top: -16px; left: 25px; }
      .cloud-static-2 {
        width: 48px; height: 18px;
        top: 11%; left: 60%;
        opacity: 0.3;
        animation-delay: -3s;
      }
      .cloud-static-2::before { width: 24px; height: 24px; top: -12px; left: 8px; }
      .cloud-static-2::after { width: 28px; height: 28px; top: -14px; left: 22px; }
      .cloud-static-3 {
        width: 42px; height: 16px;
        top: 18%; left: 45%;
        opacity: 0.28;
        animation-delay: -5s;
      }
      .cloud-static-3::before { width: 20px; height: 20px; top: -10px; left: 7px; }
      .cloud-static-3::after { width: 24px; height: 24px; top: -12px; left: 18px; }
      
      /* Moving clouds - use individual properties to not override duration/delay */
      .cloud-moving {
        animation-name: cloud-drift;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }
      
      @keyframes cloud-drift {
        0% { transform: translateX(0); }
        100% { transform: translateX(calc(100vw + 200px)); }
      }
      @keyframes cloud-float {
        0%, 100% { transform: translateX(0) translateY(0); }
        25% { transform: translateX(5px) translateY(-3px); }
        50% { transform: translateX(0) translateY(-5px); }
        75% { transform: translateX(-5px) translateY(-2px); }
      }

      /* Night mode house dimming */
      .house-img.night-mode {
        filter: drop-shadow(0 20px 40px rgba(0,0,0,0.5)) brightness(0.55) saturate(0.85);
        transition: filter 1s ease;
      }
      
      /* Night background adjustment - subtle darkening at top */
      .visual-container.night-mode {
        background: linear-gradient(
          to bottom,
          rgba(15, 23, 42, 0.2) 0%,
          transparent 40%
        );
      }
    `;
  }

  render() {
    if (!this.shadowRoot) return;

    // Get current values - use _getStateInWatts for power sensors to handle kW units (e.g. from evcc)
    const solarPower = this._getStateInWatts(this._config.solar_power, 0);
    const gridPowerDisplay = this._getGridPowerDisplay();
    const batterySoc = this._getState(this._config.battery_soc, 0); // SOC is percentage, not power
    const homeConsumption = this._getStateInWatts(this._config.home_consumption, 0);
    const evPower = this._getStateInWatts(this._config.ev_power, 0);
    const hasEV = !!this._config.ev_power;
    const hasBattery = !!this._config.battery_soc;
    const houseImg = this._config.image;
    
    // Get weather data
    const weatherData = this._getWeatherData();

    // Determine flow states (combined sensors: signed power; split sensors: separate import/export, charge/discharge)
    const isSolarActive = solarPower > 50;
    const isGridImport = this._isGridImport();
    const isGridExport = this._isGridExport();
    const isBatteryCharging = this._isBatteryCharging();
    const isBatteryDischarging = this._isBatteryDischarging();
    const isEvCharging = evPower > 50;

    // Battery icon based on SOC
    let batteryIcon = "mdi:battery";
    if (batterySoc >= 90) batteryIcon = "mdi:battery";
    else if (batterySoc >= 70) batteryIcon = "mdi:battery-80";
    else if (batterySoc >= 50) batteryIcon = "mdi:battery-60";
    else if (batterySoc >= 30) batteryIcon = "mdi:battery-40";
    else if (batterySoc >= 10) batteryIcon = "mdi:battery-20";
    else batteryIcon = "mdi:battery-outline";
    
    if (isBatteryCharging) batteryIcon = "mdi:battery-charging";

    // Get pill positions and scale from config (with defaults)
    const pillPos = {
      solar: { x: this._config.solar_pill_left, y: this._config.solar_pill_top, scale: this._config.solar_pill_scale },
      grid: { x: this._config.grid_pill_left, y: this._config.grid_pill_top, scale: this._config.grid_pill_scale },
      home: { x: this._config.home_pill_left, y: this._config.home_pill_top, scale: this._config.home_pill_scale },
      battery: { x: this._config.battery_pill_left, y: this._config.battery_pill_top, scale: this._config.battery_pill_scale },
      ev: { x: this._config.ev_pill_left, y: this._config.ev_pill_top, scale: this._config.ev_pill_scale }
    };

    // Helper to calculate control point for smooth curves
    const midPoint = (p1, p2) => ({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    });

    // SVG Paths for energy flows (dynamically calculated based on pill positions)
    const paths = {
      // Solar flows from top (roof area)
      solarToHome: `M ${pillPos.solar.x} ${pillPos.solar.y} Q ${midPoint(pillPos.solar, pillPos.home).x + 1} ${midPoint(pillPos.solar, pillPos.home).y} ${pillPos.home.x} ${pillPos.home.y}`,
      solarToBattery: `M ${pillPos.solar.x} ${pillPos.solar.y} Q ${midPoint(pillPos.solar, pillPos.battery).x} ${midPoint(pillPos.solar, pillPos.battery).y} ${pillPos.battery.x} ${pillPos.battery.y}`,
      solarToGrid: `M ${pillPos.solar.x} ${pillPos.solar.y} Q ${midPoint(pillPos.solar, pillPos.grid).x} ${midPoint(pillPos.solar, pillPos.grid).y} ${pillPos.grid.x} ${pillPos.grid.y}`,
      
      // Grid flows from left (power pole)
      gridToHome: `M ${pillPos.grid.x} ${pillPos.grid.y} Q ${midPoint(pillPos.grid, pillPos.home).x} ${midPoint(pillPos.grid, pillPos.home).y} ${pillPos.home.x} ${pillPos.home.y}`,
      gridToBattery: `M ${pillPos.grid.x} ${pillPos.grid.y} Q ${midPoint(pillPos.grid, pillPos.battery).x} ${midPoint(pillPos.grid, pillPos.battery).y} ${pillPos.battery.x} ${pillPos.battery.y}`,
      
      // Battery flows from right (battery storage)
      batteryToHome: `M ${pillPos.battery.x} ${pillPos.battery.y} Q ${midPoint(pillPos.battery, pillPos.home).x} ${midPoint(pillPos.battery, pillPos.home).y} ${pillPos.home.x} ${pillPos.home.y}`,
      batteryToGrid: `M ${pillPos.battery.x} ${pillPos.battery.y} Q ${midPoint(pillPos.battery, pillPos.grid).x} ${midPoint(pillPos.battery, pillPos.grid).y} ${pillPos.grid.x} ${pillPos.grid.y}`,
      
      // EV flow from home (EV is sub-load of home)
      homeToEv: `M ${pillPos.home.x} ${pillPos.home.y} Q ${midPoint(pillPos.home, pillPos.ev).x} ${midPoint(pillPos.home, pillPos.ev).y} ${pillPos.ev.x} ${pillPos.ev.y}`
    };

    // Colors
    const colors = {
      solar: '#F59E0B',
      grid: '#3B82F6',
      battery: '#10B981',
      home: '#8B5CF6',
      ev: '#EC4899'
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .card {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(30, 32, 36, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3);
          color: white;
          box-sizing: border-box;
          user-select: none;
        }
        
        .noise {
          position: absolute;
          inset: 0;
          opacity: 0.02;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }

        /* Header - must be above weather animations */
        .header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 50;
          background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent);
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .icon-circle {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          border-radius: 50%;
          background: linear-gradient(145deg, rgba(25, 27, 30, 1), rgba(30, 32, 38, 1));
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${colors.solar};
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 3px 3px 8px rgba(0, 0, 0, 0.7), inset -2px -2px 4px rgba(255, 255, 255, 0.03);
        }
        .icon-circle ha-icon {
          width: 22px;
          height: 22px;
          --mdc-icon-size: 22px;
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.6));
        }
        
        .title-group h2 {
          font-size: 1.125rem;
          font-weight: 700;
          line-height: 1;
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }
        
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px #22c55e;
        }
        
        .live-text {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #4ade80;
        }
        
        .weather-separator {
          margin: 0 6px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.65rem;
        }
        
        .weather-status {
          font-size: 0.65rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.4);
        }
        
        .autarkie-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
        }
        
        .autarkie-text {
          font-size: 0.8rem;
          font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
        }
        
        /* Responsive Header */
        @container energy-card (max-width: 400px) {
          .header {
            padding: 16px 18px;
          }
          .icon-circle {
            width: 34px;
            height: 34px;
            min-width: 34px;
            min-height: 34px;
          }
          .icon-circle ha-icon {
            width: 18px;
            height: 18px;
            --mdc-icon-size: 18px;
          }
          .title-group h2 {
            font-size: 1rem;
          }
          .live-text, .weather-status {
            font-size: 0.6rem;
          }
          .autarkie-badge {
            padding: 6px 10px;
            gap: 6px;
          }
          .autarkie-text {
            font-size: 0.7rem;
          }
          .autarkie-badge ha-icon {
            --mdc-icon-size: 14px;
          }
        }
        
        @container energy-card (max-width: 320px) {
          .header {
            padding: 12px 14px;
          }
          .header-left {
            gap: 8px;
          }
          .icon-circle {
            width: 30px;
            height: 30px;
            min-width: 30px;
            min-height: 30px;
          }
          .icon-circle ha-icon {
            width: 16px;
            height: 16px;
            --mdc-icon-size: 16px;
          }
          .title-group h2 {
            font-size: 0.9rem;
          }
          .live-indicator {
            margin-top: 2px;
          }
          .dot {
            width: 5px;
            height: 5px;
          }
          .live-text {
            font-size: 0.55rem;
          }
          .weather-status {
            display: none; /* Hide weather status on very small screens */
          }
          .weather-separator {
            display: none;
          }
          .autarkie-badge {
            padding: 5px 8px;
            gap: 4px;
          }
          .autarkie-text {
            font-size: 0.65rem;
          }
          .autarkie-badge ha-icon {
            --mdc-icon-size: 12px;
          }
        }

        /* Main Visual */
        .visual-container {
          position: relative;
          width: 100%;
          min-height: 250px;
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          padding-top: 20px;
        }
        
        /* Responsive visual container */
        @container energy-card (max-width: 400px) {
          .visual-container {
            min-height: 200px;
            padding-top: 15px;
          }
        }
        
        @container energy-card (max-width: 320px) {
          .visual-container {
            min-height: 180px;
            padding-top: 10px;
          }
        }
        
        .house-img {
          width: 110%;
          max-width: none;
          object-fit: contain;
          margin-left: -1.5rem;
          margin-top: 1rem;
          z-index: 0;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.4));
        }
        
        .bottom-gradient {
          position: absolute;
          inset: auto 0 0 0;
          height: 8rem;
          background: linear-gradient(to top, rgba(30, 32, 36, 1), transparent);
          pointer-events: none;
          z-index: 5;
        }

        /* SVG Overlay */
        .svg-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }

        /* Animations */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        
        /* 
         * Smooth flow animation - simple dash moving along path
         * Like reference: https://www.mediaevent.de/wp-content/uploads/2021/06/schach-dashline-lineart.svg
         */
        @keyframes flow-animation {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        
        @keyframes flow-animation-reverse {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: 100;
          }
        }
        
        @keyframes track-pulse {
          0%, 100% {
            stroke-opacity: 0.18;
          }
          50% {
            stroke-opacity: 0.06;
          }
        }
        
        .flow-track {
          animation: track-pulse 2.2s ease-in-out infinite;
        }
        
        .flow-beam {
          stroke-dasharray: 25 75;
          animation: flow-animation 3s linear infinite;
        }
        
        .flow-beam.reverse {
          stroke-dasharray: 25 75;
          animation: flow-animation-reverse 3s linear infinite;
        }

        /* Data Pills - Inlet Style */
        .pill {
          --pill-scale: 1;
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(20, 20, 20, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 999px;
          padding: 6px 10px 6px 6px;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.6),
            inset -1px -1px 2px rgba(255, 255, 255, 0.03),
            0 4px 8px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-top: 1px solid rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          z-index: 20;
          transform: translate(-50%, -50%) scale(var(--pill-scale));
          white-space: nowrap;
          transition: all 0.3s ease;
        }
        
        .pill:hover {
          transform: translate(-50%, -50%) scale(calc(var(--pill-scale) * 1.03));
        }
        
        .pill[data-entity],
        .pill[data-custom-pill] {
          cursor: pointer;
        }
        
        .pill[data-entity]:active {
          transform: translate(-50%, -50%) scale(calc(var(--pill-scale) * 0.97));
        }
        
        .house-img {
          cursor: pointer;
          transition: filter 0.2s ease;
        }
        
        .house-img:hover {
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.4)) brightness(1.05);
        }
        
        .pill-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .pill-icon ha-icon {
          --mdc-icon-size: 16px;
        }
        
        .pill-content {
          display: flex;
          flex-direction: column;
          line-height: 1;
          gap: 1px;
        }
        
        .pill-val {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
        }
        
        .pill-label {
          font-size: 0.5rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.4);
        }
        
        /* Responsive Pills */
        @container energy-card (max-width: 400px) {
          .pill {
            padding: 5px 8px 5px 5px;
            gap: 6px;
          }
          .pill-icon {
            width: 24px;
            height: 24px;
          }
          .pill-icon ha-icon {
            --mdc-icon-size: 14px;
          }
          .pill-val {
            font-size: 0.7rem;
          }
          .pill-label {
            font-size: 0.45rem;
          }
        }
        
        @container energy-card (max-width: 320px) {
          .pill {
            padding: 4px 6px 4px 4px;
            gap: 4px;
          }
          .pill-icon {
            width: 20px;
            height: 20px;
          }
          .pill-icon ha-icon {
            --mdc-icon-size: 12px;
          }
          .pill-val {
            font-size: 0.6rem;
          }
          .pill-label {
            font-size: 0.4rem;
            display: none; /* Hide labels on very small screens */
          }
        }

        /* Pill Icon Colors */
        .bg-solar {
          background: rgba(245, 158, 11, 0.15);
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
        }
        .color-solar { color: ${colors.solar}; }
        
        .bg-grid {
          background: rgba(59, 130, 246, 0.15);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
        }
        .color-grid { color: ${colors.grid}; }
        
        .bg-battery {
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
        }
        .color-battery { color: ${colors.battery}; }
        
        .bg-home {
          background: rgba(139, 92, 246, 0.15);
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
        }
        .color-home { color: ${colors.home}; }
        
        .bg-ev {
          background: rgba(236, 72, 153, 0.15);
          box-shadow: 0 0 8px rgba(236, 72, 153, 0.3);
        }
        .color-ev { color: ${colors.ev}; }
        
        .bg-inactive {
          background: rgba(255, 255, 255, 0.03);
          box-shadow: none;
        }
        .color-inactive { color: rgba(255, 255, 255, 0.35); }

        .power-overlay {
          position: absolute;
          z-index: 25;
          transform: translate(-50%, -50%) rotate(var(--overlay-angle, 0deg)) scale(var(--overlay-scale, 1));
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
          font-size: calc(0.8rem * var(--overlay-scale, 1));
          font-weight: 700;
          line-height: 1.1;
          pointer-events: none;
          white-space: nowrap;
          filter: drop-shadow(0 0 var(--overlay-glow-blur, 0px) var(--overlay-glow-color, transparent));
        }
        .power-overlay .overlay-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: calc(0.15rem * var(--overlay-scale, 1));
        }
        .power-overlay .overlay-row {
          display: flex;
          align-items: center;
          gap: calc(0.25rem * var(--overlay-scale, 1));
        }
        .power-overlay .overlay-label {
          font-size: calc(0.55rem * var(--overlay-scale, 1));
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.85;
          text-shadow:
            0 0 var(--overlay-glow-blur, 0px) var(--overlay-glow-color, transparent),
            0 0 var(--overlay-glow-spread, 0px) var(--overlay-glow-color, transparent),
            0 1px 4px rgba(0, 0, 0, 0.9);
        }
        .power-overlay .overlay-icon {
          --mdc-icon-size: calc(16px * var(--overlay-scale, 1));
          flex-shrink: 0;
          filter: drop-shadow(0 0 calc(var(--overlay-glow-blur, 0px) * 0.6) var(--overlay-glow-color, transparent));
        }
        .power-overlay .overlay-val {
          line-height: 1;
          text-shadow:
            0 0 var(--overlay-glow-blur, 0px) var(--overlay-glow-color, transparent),
            0 0 var(--overlay-glow-spread, 0px) var(--overlay-glow-color, transparent),
            0 1px 6px rgba(0, 0, 0, 0.85);
        }
        .bg-status { background: rgba(74, 222, 128, 0.15); box-shadow: 0 0 8px rgba(74, 222, 128, 0.3); }
        .color-status { color: #4ade80; }

        ha-icon {
          --mdc-icon-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        ${this._getWeatherStyles()}
      </style>

      <div class="card">
        <div class="noise"></div>
        
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            ${this._config.show_header_icon ? `
            <div class="icon-circle">
              <ha-icon icon="${this._config.header_icon}"></ha-icon>
            </div>
            ` : ''}
            <div class="title-group">
              <h2>${this._config.name}</h2>
              <div class="live-indicator">
                <div class="dot"></div>
                <span class="live-text">Live</span>
                ${weatherData.enabled ? `
                <span class="weather-separator">|</span>
                <span class="weather-status">${this._getDayNightLabel(weatherData.isNight)} â€¢ ${this._getWeatherLabel(weatherData)}</span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Main Visual -->
        <div class="visual-container ${weatherData.enabled && weatherData.isNight ? 'night-mode' : ''}">
          ${weatherData.enabled ? this._renderWeatherEffects(weatherData) : ''}
          <img src="${houseImg}" class="house-img ${weatherData.enabled && weatherData.isNight ? 'night-mode' : ''}" alt="Energy Home" />
          <div class="bottom-gradient"></div>

          <!-- SVG Flows -->
          <svg class="svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
            <!-- Glow filter definition -->
            <defs>
              <!-- Stroke Glow Filter (optimized: 2 blur instead of 3, ~39% faster) -->
              <filter id="strokeGlow" x="-100%" y="-100%" width="300%" height="300%" filterUnits="userSpaceOnUse">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.0" result="blur" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="softCore" />
                <feColorMatrix in="softCore" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" result="core" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="core" />
                  <feMergeNode in="core" />
                  <feMergeNode in="core" />
                </feMerge>
              </filter>
              <!-- Soft Core Filter (minimal blur for smooth edges) -->
              <filter id="softEdge" x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
              </filter>
            </defs>
            
            <!-- Solar Flows -->
            ${this._renderFlow(paths.solarToHome, colors.solar, isSolarActive && homeConsumption > 0, false, 'flow-solar-home')}
            ${hasBattery ? this._renderFlow(paths.solarToBattery, colors.solar, isSolarActive && isBatteryCharging, false, 'flow-solar-battery') : ''}
            ${this._renderFlow(paths.solarToGrid, colors.solar, isSolarActive && isGridExport, false, 'flow-solar-grid')}

            <!-- Grid Flows -->
            ${this._renderFlow(paths.gridToHome, colors.grid, isGridImport, false, 'flow-grid-home')}
            ${hasBattery ? this._renderFlow(paths.gridToBattery, colors.grid, isGridImport && isBatteryCharging, false, 'flow-grid-battery') : ''}

            <!-- Battery Flows -->
            ${hasBattery ? this._renderFlow(paths.batteryToHome, colors.battery, isBatteryDischarging, false, 'flow-battery-home') : ''}
            ${hasBattery ? this._renderFlow(paths.batteryToGrid, colors.battery, isBatteryDischarging && isGridExport, false, 'flow-battery-grid') : ''}

            <!-- EV Flow (sub-load of home) -->
            ${hasEV ? this._renderFlow(paths.homeToEv, colors.ev, isEvCharging, false, 'flow-home-ev') : ''}
          </svg>

          <!-- Solar Pill (Top - Roof) - Clickable for history -->
          <div class="pill pill-solar" style="top: ${pillPos.solar.y}%; left: ${pillPos.solar.x}%; --pill-scale: ${pillPos.solar.scale};" data-entity="${this._config.solar_power}">
            <div class="pill-icon ${isSolarActive ? 'bg-solar' : 'bg-inactive'}">
              <ha-icon icon="mdi:solar-power" class="${isSolarActive ? 'color-solar' : 'color-inactive'}"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${this._formatPower(solarPower)}</span>
              <span class="pill-label">${isSolarActive ? this._t('production') : this._t('inactive')}</span>
            </div>
          </div>

          <!-- Grid Pill (Left - Power Pole) - Clickable for history -->
          <div class="pill pill-grid" style="top: ${pillPos.grid.y}%; left: ${pillPos.grid.x}%; --pill-scale: ${pillPos.grid.scale};" data-entity="${this._getGridPillEntity()}">
            <div class="pill-icon ${isGridImport || isGridExport ? 'bg-grid' : 'bg-inactive'}">
              <ha-icon icon="mdi:transmission-tower" class="${isGridImport || isGridExport ? 'color-grid' : 'color-inactive'}"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${this._formatPower(gridPowerDisplay)}</span>
              <span class="pill-label">${isGridExport ? this._t('export') : isGridImport ? this._t('import') : this._t('neutral')}</span>
            </div>
          </div>

          <!-- Home Pill (Center - House) - Clickable for history -->
          <div class="pill pill-home" style="top: ${pillPos.home.y}%; left: ${pillPos.home.x}%; --pill-scale: ${pillPos.home.scale};" data-entity="${this._config.home_consumption}">
            <div class="pill-icon bg-home">
              <ha-icon icon="mdi:home-lightning-bolt" class="color-home"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${this._formatPower(homeConsumption)}</span>
              <span class="pill-label">${this._t('consumption')}</span>
            </div>
          </div>

          <!-- Battery Pill (Right - Battery Storage) - Clickable for history -->
          ${hasBattery ? `
          <div class="pill pill-battery" style="top: ${pillPos.battery.y}%; left: ${pillPos.battery.x}%; --pill-scale: ${pillPos.battery.scale};" data-entity="${this._config.battery_soc}">
            <div class="pill-icon ${isBatteryCharging || isBatteryDischarging ? 'bg-battery' : 'bg-inactive'}">
              <ha-icon icon="${batteryIcon}" class="${isBatteryCharging || isBatteryDischarging ? 'color-battery' : 'color-inactive'}"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${Math.round(batterySoc)}%</span>
              <span class="pill-label">${isBatteryCharging ? this._t('charging') : isBatteryDischarging ? this._t('discharging') : this._t('standby')}</span>
            </div>
          </div>
          ` : ''}

          <!-- EV Pill (Bottom Left - Carport) - Clickable for history -->
          ${hasEV ? `
          <div class="pill pill-ev" style="top: ${pillPos.ev.y}%; left: ${pillPos.ev.x}%; --pill-scale: ${pillPos.ev.scale};" data-entity="${this._config.ev_power}">
            <div class="pill-icon ${isEvCharging ? 'bg-ev' : 'bg-inactive'}">
              <ha-icon icon="mdi:car-electric" class="${isEvCharging ? 'color-ev' : 'color-inactive'}"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val">${isEvCharging ? this._formatPower(evPower) : this._t('idle')}</span>
              <span class="pill-label">${this._config.ev_label || 'EV'}</span>
            </div>
          </div>
          ` : ''}

          <!-- Custom Pills (optional) -->
          ${this._renderAllOverlays()}
          ${this._renderStatusPill()}
          ${this._renderCustomPills()}
        </div>

        <!-- details removed -->
        ${false ? `
        <div class="details-wrapper">
        <div class="details-grid ${!hasBattery ? 'no-battery' : ''}">
          <!-- Solar -->
          <div class="detail-col">
            <div class="detail-header">Solar</div>
            <div class="detail-content">
              ${this._renderSolarDetails(solarPower, colors.solar)}
            </div>
            <div class="detail-bar">
              ${this._renderSolarBar(solarPower, colors.solar)}
            </div>
          </div>

          <!-- Grid -->
          <div class="detail-col">
            <div class="detail-header">${this._t('grid')}</div>
            <div class="detail-content">
              ${this._renderGridDetails(colors)}
            </div>
            <div class="detail-bar">
              ${this._renderGridBar(colors, isGridImport, isGridExport)}
            </div>
          </div>

          <!-- Consumption (including EV if configured) -->
          <div class="detail-col">
            <div class="detail-header">${this._t('consumption')}</div>
            <div class="detail-content">
              <div class="detail-row">
                <span class="detail-label">${this._t('current')}</span>
                <span class="detail-val">${this._formatPower(homeConsumption)}</span>
              </div>
              ${hasEV ? `
              <div class="detail-row">
                <span class="detail-label">E-Auto</span>
                <span class="detail-val" style="color: ${isEvCharging ? colors.ev : 'rgba(255,255,255,0.4)'};">${isEvCharging ? this._formatPower(evPower) : this._t('idle')}</span>
              </div>
              ` : ''}
            </div>
            <div class="detail-bar">
              ${hasEV && isEvCharging ? (() => {
                const totalConsumption = homeConsumption + evPower;
                const totalPercent = Math.min(100, (totalConsumption / this._config.max_consumption) * 100);
                const homeWidth = totalPercent * (homeConsumption / totalConsumption);
                const evWidth = totalPercent * (evPower / totalConsumption);
                return `<div class="detail-fill-stack"><div class="detail-fill-segment" style="flex-basis:${homeWidth}%;background:${colors.home}"></div><div class="detail-fill-segment" style="flex-basis:${evWidth}%;background:${colors.ev}"></div></div>`;
              })() : `
              <div class="detail-fill" style="width: ${Math.min(100, (homeConsumption / this._config.max_consumption) * 100)}%; background: ${colors.home};"></div>
              `}
            </div>
          </div>

          <!-- Storage -->
          ${hasBattery ? `
          <div class="detail-col">
            <div class="detail-header">${this._t('storage')}</div>
            <div class="detail-content">
              ${this._renderStorageDetails(colors, batterySoc)}
            </div>
            <div class="detail-bar">
              <div class="detail-fill" style="width: ${batterySoc}%; background: ${colors.battery};"></div>
            </div>
          </div>
          ` : ''}
        </div>
        </div>
        ` : ''}
      </div>
    `;
    
    // Setup click event listeners after rendering
    this._setupEventListeners();
  }
}

// Register card component
customElements.define('prism-energy', PrismEnergyCard);

// Register with HACS / HA card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "prism-energy",
  name: "Prism Energy",
  preview: true,
  description: "A glassmorphism energy flow card for OpenEMS/Fenecon systems"
});

console.info(
  `%c PRISM-ENERGY %c v1.3.6 %c Tesla connected overlay `,
  'background: #F59E0B; color: black; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #1e2024; color: white; font-weight: bold; padding: 2px 6px;',
  'background: #3B82F6; color: white; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

