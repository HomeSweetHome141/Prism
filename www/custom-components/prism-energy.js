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
 * @version 1.5.5
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
        label: options.entityLabel || "Entity",
        selector: options.entityDomain ? { entity: { domain: options.entityDomain } } : { entity: {} }
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
    // 10 generic, entity-driven overlays. Each retains all styling settings.
    const positions = [
      { top: 18, left: 72 }, { top: 48, left: 92 }, { top: 70, left: 28 },
      { top: 56, left: 94 }, { top: 64, left: 94 }, { top: 78, left: 26 },
      { top: 30, left: 20 }, { top: 40, left: 50 }, { top: 24, left: 40 },
      { top: 84, left: 60 }
    ];
    for (let i = 1; i <= 10; i++) {
      const prefix = `overlay_${i}`;
      const p = positions[i - 1] || { top: 30, left: 50 };
      target[`${prefix}_enabled`] = config[`${prefix}_enabled`] !== false;
      target[`${prefix}_entity`] = config[`${prefix}_entity`] || "";
      target[`${prefix}_label`] = config[`${prefix}_label`] ?? `Overlay ${i}`;
      target[`${prefix}_show_label`] = config[`${prefix}_show_label`] !== undefined
        ? config[`${prefix}_show_label`] === true
        : true;
      target[`${prefix}_icon`] = config[`${prefix}_icon`] || "mdi:information-outline";
      target[`${prefix}_color`] = config[`${prefix}_color`] || [34, 211, 238];
      target[`${prefix}_opacity`] = config[`${prefix}_opacity`] ?? 1.0;
      target[`${prefix}_glow`] = config[`${prefix}_glow`] ?? 0.4;
      target[`${prefix}_angle`] = config[`${prefix}_angle`] ?? 0;
      target[`${prefix}_show_icon`] = config[`${prefix}_show_icon`] !== false;
      target[`${prefix}_top`] = config[`${prefix}_top`] ?? p.top;
      target[`${prefix}_left`] = config[`${prefix}_left`] ?? p.left;
      target[`${prefix}_scale`] = config[`${prefix}_scale`] ?? 0.85;
    }
  }

  static _customPillActionFields(index) {
    return [
      {
        name: `custom_pill_${index}_dim_when_off`,
        label: "Grey icon when off or disabled",
        selector: { boolean: {} }
      },
      {
        name: `custom_pill_${index}_breathe_when_on`,
        label: "Breathe icon glow when on/enabled",
        selector: { boolean: {} }
      },
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
      header_top: 5,
      header_left: 12,
      header_scale: 1.0,
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
      manual_weather_mode: "auto",
      manual_weather_day: "sunny",
      manual_weather_night: "clear",
      manual_weather_day_phase: "auto",
      weather_cycle_button_show: false,
      weather_cycle_button_icon: "mdi:weather-partly-cloudy",
      weather_cycle_button_label: "Weather",
      weather_cycle_button_show_label: true,
      weather_cycle_button_top: 18,
      weather_cycle_button_left: 88,
      weather_cycle_button_scale: 1.0,
      // Beam + particle appearance
      beam_color: "",
      beam_size: 1.2,
      beam_speed: 3,
      particle_color: [255, 255, 255],
      particle_size: 3,
      particle_speed: 3,
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
      status_pill_top: 12,
      status_pill_left: 78,
      status_pill_scale: 1.0,
      extra_pill_entity: "",
      extra_pill_icon: "mdi:information-outline",
      extra_pill_color: [96, 165, 250],
      extra_pill_label: "",
      extra_pill_show_label: false,
      extra_pill_top: 8,
      extra_pill_left: 65,
      extra_pill_scale: 1.0,
      extra_pill_2_entity: "",
      extra_pill_2_icon: "mdi:flash-outline",
      extra_pill_2_color: [168, 85, 247],
      extra_pill_2_label: "",
      extra_pill_2_show_label: false,
      extra_pill_2_top: 8,
      extra_pill_2_left: 85,
      extra_pill_2_scale: 1.0
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
          type: "expandable",
          name: "",
          title: "Header Position",
          schema: [
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "header_top",
                  label: "Position top %",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "header_left",
                  label: "Position left %",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "header_scale",
                  label: "Header size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                },
                {
                  name: "header_transparent",
                  label: "Transparent header background",
                  selector: { boolean: {} }
                }
              ]
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
          name: "color_theme",
          label: "Color theme",
          selector: { select: { mode: "dropdown", options: [
            { value: "default", label: "Default" },
            { value: "neon", label: "Neon" },
            { value: "soft", label: "Soft" },
            { value: "mono", label: "Mono" },
            { value: "ocean", label: "Ocean" }
          ] } }
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
          label: "Grid Power - combined (optional if import/export set; +import, -export)",
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
          label: "Battery Power - combined (optional if charge/discharge set; +discharge, -charge)",
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
          name: "ev_battery_entity",
          label: "EV / Tesla battery % entity (shown inside the EV circle)",
          selector: { entity: {} }
        },
        {
          name: "ev_soc_entity",
          label: "EV battery % overlay (optional, legacy)",
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
          name: "extra_pill_entity",
          label: "Extra pill entity (optional, any entity)",
          selector: { entity: {} }
        },
        {
          name: "extra_pill_icon",
          label: "Extra pill icon",
          selector: { icon: {} }
        },
        {
          name: "extra_pill_color",
          label: "Extra pill icon color",
          selector: { color_rgb: {} }
        },
        {
          name: "extra_pill_label",
          label: "Extra pill label (optional)",
          selector: { text: {} }
        },
        {
          name: "extra_pill_show_label",
          label: "Show extra pill label",
          selector: { boolean: {} }
        },
        {
          name: "extra_pill_2_entity",
          label: "Extra pill 2 entity (optional, any entity)",
          selector: { entity: {} }
        },
        {
          name: "extra_pill_2_icon",
          label: "Extra pill 2 icon",
          selector: { icon: {} }
        },
        {
          name: "extra_pill_2_color",
          label: "Extra pill 2 icon color",
          selector: { color_rgb: {} }
        },
        {
          name: "extra_pill_2_label",
          label: "Extra pill 2 label (optional)",
          selector: { text: {} }
        },
        {
          name: "extra_pill_2_show_label",
          label: "Show extra pill 2 label",
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
            },
            { name: "", type: "divider" },
            {
              name: "manual_weather_mode",
              label: "Manual Weather (override live data)",
              selector: { select: { mode: "dropdown", options: [
                { value: "auto", label: "Auto (use live weather)" },
                { value: "day", label: "Force Day effect" },
                { value: "night", label: "Force Night effect" }
              ] } }
            },
            {
              name: "manual_weather_day",
              label: "Day effect (used when Force Day is selected)",
              selector: { select: { mode: "dropdown", options: [
                { value: "sunny", label: "Sunny" },
                { value: "clear", label: "Clear" },
                { value: "partlycloudy", label: "Partly Cloudy" },
                { value: "cloudy", label: "Cloudy" },
                { value: "rainy", label: "Rain" },
                { value: "stormy", label: "Storm (lightning)" },
                { value: "snowy", label: "Snow" },
                { value: "hail", label: "Hail" },
                { value: "foggy", label: "Fog" },
                { value: "windy", label: "Windy" }
              ] } }
            },
            {
              name: "manual_weather_day_phase",
              label: "Day sun phase (for sun color/position preview)",
              selector: { select: { mode: "dropdown", options: [
                { value: "auto", label: "Auto (from sun position/time)" },
                { value: "sunrise_1", label: "Sunrise 1 (pale blue + soft pink)" },
                { value: "sunrise_2", label: "Sunrise 2 (peach + lavender)" },
                { value: "morning", label: "Morning (light orange/yellow)" },
                { value: "late_morning", label: "Late Morning (warm bright)" },
                { value: "noon", label: "Noon (bright yellow)" },
                { value: "afternoon", label: "Afternoon (yellow-orange)" },
                { value: "sunset_1", label: "Sunset 1 (deep orange + gold)" },
                { value: "sunset_2", label: "Sunset 2 (red + purple + dusty blue)" }
              ] } }
            },
            {
              name: "manual_weather_night",
              label: "Night effect (used when Force Night is selected)",
              selector: { select: { mode: "dropdown", options: [
                { value: "clear", label: "Clear (stars + moon)" },
                { value: "partlycloudy", label: "Partly Cloudy" },
                { value: "cloudy", label: "Cloudy" },
                { value: "rainy", label: "Rain" },
                { value: "stormy", label: "Storm (lightning)" },
                { value: "snowy", label: "Snow" },
                { value: "hail", label: "Hail" },
                { value: "foggy", label: "Fog" },
                { value: "windy", label: "Windy" }
              ] } }
            },
            { name: "", type: "divider" },
            {
              type: "expandable",
              name: "",
              title: "Manual Weather Cycle Button",
              schema: [
                {
                  name: "weather_cycle_button_show",
                  label: "Show cycle button",
                  selector: { boolean: {} }
                },
                {
                  name: "weather_cycle_button_icon",
                  label: "Button icon",
                  selector: { icon: {} }
                },
                {
                  name: "weather_cycle_button_label",
                  label: "Button label",
                  selector: { text: {} }
                },
                {
                  name: "weather_cycle_button_show_label",
                  label: "Show button label",
                  selector: { boolean: {} }
                },
                {
                  type: "grid",
                  name: "",
                  schema: [
                    {
                      name: "weather_cycle_button_top",
                      label: "Position top %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "weather_cycle_button_left",
                      label: "Position left %",
                      selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                    },
                    {
                      name: "weather_cycle_button_scale",
                      label: "Button size",
                      selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "✨ Beam & Particle Effects",
          schema: [
            {
              name: "beam_color",
              label: "Beam color",
              selector: { color_rgb: {} }
            },
            {
              name: "beam_size",
              label: "Beam width",
              selector: { number: { min: 0.2, max: 5, step: 0.1, mode: "box" } }
            },
            {
              name: "beam_speed",
              label: "Beam animation duration (seconds)",
              selector: { number: { min: 0.5, max: 10, step: 0.1, mode: "box", unit_of_measurement: "s" } }
            },
            {
              name: "particle_color",
              label: "Particle color",
              selector: { color_rgb: {} }
            },
            {
              name: "particle_size",
              label: "Particle size",
              selector: { number: { min: 1, max: 10, step: 0.5, mode: "box" } }
            },
            {
              name: "particle_speed",
              label: "Particle animation duration (seconds)",
              selector: { number: { min: 0.5, max: 10, step: 0.1, mode: "box", unit_of_measurement: "s" } }
            }
          ]
        },
        {
          type: "expandable",
          name: "",
          title: "📊 Maximum Values for Progress Bars",
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
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "extra_pill_top",
                  label: "Extra pill top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "extra_pill_left",
                  label: "Extra pill left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "extra_pill_scale",
                  label: "Extra pill size",
                  selector: { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }
                }
              ]
            },
            {
              type: "grid",
              name: "",
              schema: [
                {
                  name: "extra_pill_2_top",
                  label: "Extra pill 2 top",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "extra_pill_2_left",
                  label: "Extra pill 2 left",
                  selector: { number: { min: 0, max: 100, step: 1, mode: "box" } }
                },
                {
                  name: "extra_pill_2_scale",
                  label: "Extra pill 2 size",
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
          schema: Array.from({ length: 10 }, (_, i) =>
            PrismEnergyCard._overlayPanel(`overlay_${i + 1}`, `Overlay ${i + 1}`, {
              entityField: true,
              entityLabel: "Entity (any)"
            })
          )
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
                  label: "Label (optional, e.g. 'Aussen')",
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
      header_top: config.header_top ?? 5,
      header_left: config.header_left ?? 12,
      header_scale: config.header_scale ?? 1.0,
      header_transparent: config.header_transparent === true,
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
      color_theme: config.color_theme || "default",
      // Max values for progress bars (in Watts)
      max_solar_power: config.max_solar_power || 10000,
      max_grid_power: config.max_grid_power || 10000,
      max_consumption: config.max_consumption || 10000,
      // Weather effects
      enable_weather_effects: config.enable_weather_effects || false,
      weather_entity: config.weather_entity || "",
      cloud_coverage_entity: config.cloud_coverage_entity || "",
      // Manual weather override
      manual_weather_mode: config.manual_weather_mode || "auto",
      manual_weather_day: config.manual_weather_day || "sunny",
      manual_weather_night: config.manual_weather_night || "clear",
      manual_weather_day_phase: config.manual_weather_day_phase || "auto",
      weather_cycle_button_show: config.weather_cycle_button_show === true,
      weather_cycle_button_icon: config.weather_cycle_button_icon || "mdi:weather-partly-cloudy",
      weather_cycle_button_label: config.weather_cycle_button_label || "Weather",
      weather_cycle_button_show_label: config.weather_cycle_button_show_label !== false,
      weather_cycle_button_top: config.weather_cycle_button_top ?? 18,
      weather_cycle_button_left: config.weather_cycle_button_left ?? 88,
      weather_cycle_button_scale: config.weather_cycle_button_scale ?? 1.0,
      beam_color: config.beam_color || "",
      beam_size: config.beam_size ?? 1.2,
      beam_speed: config.beam_speed ?? 3,
      particle_color: config.particle_color || [255, 255, 255],
      particle_size: config.particle_size ?? 3,
      particle_speed: config.particle_speed ?? 3,
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
      ev_battery_entity: config.ev_battery_entity || "",
      status_entity: config.status_entity || config.autarky || "",
      status_icon: config.status_icon || "mdi:battery-sync",
      status_label: config.status_label || "",
      status_show_label: config.status_show_label === true,
      status_pill_top: config.status_pill_top ?? 12,
      status_pill_left: config.status_pill_left ?? 78,
      status_pill_scale: config.status_pill_scale ?? 1.0,
      extra_pill_entity: config.extra_pill_entity || "",
      extra_pill_icon: config.extra_pill_icon || "mdi:information-outline",
      extra_pill_color: config.extra_pill_color || [96, 165, 250],
      extra_pill_label: config.extra_pill_label || "",
      extra_pill_show_label: config.extra_pill_show_label === true,
      extra_pill_top: config.extra_pill_top ?? 8,
      extra_pill_left: config.extra_pill_left ?? 65,
      extra_pill_scale: config.extra_pill_scale ?? 1.0,
      extra_pill_2_entity: config.extra_pill_2_entity || "",
      extra_pill_2_icon: config.extra_pill_2_icon || "mdi:flash-outline",
      extra_pill_2_color: config.extra_pill_2_color || [168, 85, 247],
      extra_pill_2_label: config.extra_pill_2_label || "",
      extra_pill_2_show_label: config.extra_pill_2_show_label === true,
      extra_pill_2_top: config.extra_pill_2_top ?? 8,
      extra_pill_2_left: config.extra_pill_2_left ?? 85,
      extra_pill_2_scale: config.extra_pill_2_scale ?? 1.0,
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
      this._config[`custom_pill_${i}_dim_when_off`] = config[`custom_pill_${i}_dim_when_off`] === true;
      this._config[`custom_pill_${i}_breathe_when_on`] = config[`custom_pill_${i}_breathe_when_on`] === true;
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
    const manual = this._config.manual_weather_mode === 'day' || this._config.manual_weather_mode === 'night';
    if (!this._config.enable_weather_effects || (!this._config.weather_entity && !manual)) return;
    
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
      visualContainer.classList.toggle('day-mode', !weatherData.isNight);
    }
    
    // Update weather label + animated icon in header
    const weatherStatus = this.shadowRoot.querySelector('.weather-status');
    if (weatherStatus) {
      const dayNightLabel = this._getDayNightLabel(weatherData.isNight);
      const weatherTypeLabel = this._getWeatherLabel(weatherData);
      weatherStatus.textContent = `${dayNightLabel} - ${weatherTypeLabel}`;
    }
    const weatherIcon = this.shadowRoot.querySelector('.header-weather-icon');
    if (weatherIcon) {
      weatherIcon.setAttribute('icon', this._getWeatherIcon(weatherData));
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
      const socColor = this._socColor(batterySoc);
      const batVal = this.shadowRoot.querySelector('.pill-battery .pill-val');
      if (batVal) batVal.style.color = socColor;
      const batIcon = this.shadowRoot.querySelector('.pill-battery .pill-icon.soc-ring');
      if (batIcon) {
        batIcon.style.setProperty('--soc', Math.round(batterySoc));
        batIcon.style.setProperty('--soc-color', socColor);
      }
      const batIconEl = this.shadowRoot.querySelector('.pill-battery .pill-icon ha-icon');
      if (batIconEl) batIconEl.setAttribute('icon', this._batteryIcon(batterySoc, isBatteryCharging));
    }
    const evBatteryEntity = this._config.ev_battery_entity || this._config.ev_soc_entity;
    if (evBatteryEntity) {
      const evSocVal = this._getState(evBatteryEntity, 0);
      const evSocColor = this._socColor(evSocVal);
      const evIcon = this.shadowRoot.querySelector('.pill-ev .pill-icon.soc-ring');
      if (evIcon) {
        evIcon.style.setProperty('--soc', Math.round(evSocVal));
        evIcon.style.setProperty('--soc-color', evSocColor);
      }
      const evSocEl = this.shadowRoot.querySelector('.pill-ev .pill-icon-soc');
      if (evSocEl) {
        evSocEl.textContent = `${Math.round(evSocVal)}%`;
        evSocEl.style.color = evSocColor;
      }
    }
    
    // Update pill labels dynamically
    this._updateElement('.pill-solar .pill-label', isSolarActive ? this._t('production') : this._t('inactive'));
    this._updateElement('.pill-grid .pill-label', isGridExport ? this._t('export') : isGridImport ? this._t('import') : this._t('neutral'));
    if (hasBattery) {
      this._updateElement('.pill-battery .pill-label', isBatteryCharging ? this._t('charging') : isBatteryDischarging ? this._t('discharging') : this._t('standby'));
    }
    
    // Color-grade grid/battery values (import/export, charge/discharge)
    const gridVal = this.shadowRoot.querySelector('.pill-grid .pill-val');
    if (gridVal) {
      gridVal.classList.toggle('val-import', isGridImport);
      gridVal.classList.toggle('val-export', isGridExport);
    }
    if (hasBattery) {
      const batVal = this.shadowRoot.querySelector('.pill-battery .pill-val');
      if (batVal) {
        batVal.classList.toggle('val-charge', isBatteryCharging);
        batVal.classList.toggle('val-discharge', isBatteryDischarging);
      }
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

  _isEntityOffOrDisabled(entityId) {
    if (!entityId || !this._hass) return false;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return true;
    const state = String(stateObj.state).toLowerCase();
    return state === 'off' || state === 'disabled' || state === 'unavailable' || state === 'unknown';
  }

  _isEntityOnOrActive(entityId) {
    return !this._isEntityOffOrDisabled(entityId);
  }

  _applyCustomPillIconStyle(index) {
    const entity = this._config[`custom_pill_${index}_entity`];
    const iconWrap = this.shadowRoot?.querySelector(`.pill-custom-${index} .pill-icon`);
    const iconEl = this.shadowRoot?.querySelector(`.pill-custom-${index} .pill-icon ha-icon`);
    if (!entity || !iconWrap || !iconEl) return;

    const dimWhenOff = this._config[`custom_pill_${index}_dim_when_off`] === true;
    const breatheWhenOn = this._config[`custom_pill_${index}_breathe_when_on`] === true;
    const isInactive = dimWhenOff && this._isEntityOffOrDisabled(entity);
    const isActive = breatheWhenOn && this._isEntityOnOrActive(entity);
    const color = this._normalizeColor(this._config[`custom_pill_${index}_color`]);
    const colorStr = `${color.r}, ${color.g}, ${color.b}`;

    iconWrap.classList.toggle('bg-inactive', isInactive);
    iconWrap.classList.toggle('custom-pill-dimmed', isInactive);
    iconWrap.classList.toggle('custom-pill-breathe', isActive);
    iconEl.classList.toggle('color-inactive', isInactive);

    if (isInactive) {
      iconWrap.style.background = '';
      iconWrap.style.boxShadow = '';
      iconWrap.style.removeProperty('--pill-r');
      iconWrap.style.removeProperty('--pill-g');
      iconWrap.style.removeProperty('--pill-b');
      iconEl.style.color = '';
    } else {
      iconWrap.style.setProperty('--pill-r', color.r);
      iconWrap.style.setProperty('--pill-g', color.g);
      iconWrap.style.setProperty('--pill-b', color.b);
      iconWrap.style.background = `rgba(${colorStr}, 0.15)`;
      if (isActive) {
        iconWrap.style.removeProperty('box-shadow');
      } else {
        iconWrap.style.boxShadow = `0 0 8px rgba(${colorStr}, 0.3)`;
      }
      iconEl.style.color = `rgb(${colorStr})`;
    }
  }

  _updateCustomPillInactiveState(index) {
    this._applyCustomPillIconStyle(index);
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
        this._updateCustomPillInactiveState(i);
      }
    }
    if (this._config.extra_pill_entity) {
      this._updateElement('.pill-extra .pill-val', this._getEntityDisplayState(this._config.extra_pill_entity));
    }
    if (this._config.extra_pill_2_entity) {
      this._updateElement('.pill-extra-2 .pill-val', this._getEntityDisplayState(this._config.extra_pill_2_entity));
    }
    if (this._config.status_entity) {
      this._updateElement('.pill-status .pill-val', this._getEntityDisplayState(this._config.status_entity));
    }
    this._updateOverlays();
  }

  // Get Custom Pill value with unit
  _getCustomPillValue(entityId) {
    if (!entityId || !this._hass) return { value: '', unit: '' };
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return { value: '-', unit: '' };
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

  // Convert hex color to "r, g, b" string
  _hexToRgbStr(hex) {
    const c = this._normalizeColor(hex);
    return `${c.r}, ${c.g}, ${c.b}`;
  }

  // Color theme presets - returns hex colors for solar/grid/battery/home/ev
  _getThemeColors() {
    const themes = {
      default: { solar: '#F59E0B', grid: '#3B82F6', battery: '#10B981', home: '#8B5CF6', ev: '#EC4899' },
      neon:    { solar: '#FFD000', grid: '#00E5FF', battery: '#00FF9C', home: '#C724FF', ev: '#FF2D9B' },
      soft:    { solar: '#EBB45A', grid: '#7BA7E0', battery: '#76C9A0', home: '#A98FD6', ev: '#E69BBE' },
      mono:    { solar: '#E2E8F0', grid: '#94A3B8', battery: '#CBD5E1', home: '#B6BEC9', ev: '#E5E7EB' },
      ocean:   { solar: '#38BDF8', grid: '#0EA5E9', battery: '#2DD4BF', home: '#6366F1', ev: '#22D3EE' }
    };
    const t = this._config?.color_theme || 'default';
    return themes[t] || themes.default;
  }

  // Gradient colour for a state-of-charge: red (low) -> amber (mid) -> green (full)
  _socColor(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    let r, g, b;
    if (p <= 50) {
      const t = p / 50;
      r = Math.round(239 + (245 - 239) * t);
      g = Math.round(68 + (158 - 68) * t);
      b = Math.round(68 + (11 - 68) * t);
    } else {
      const t = (p - 50) / 50;
      r = Math.round(245 + (34 - 245) * t);
      g = Math.round(158 + (197 - 158) * t);
      b = Math.round(11 + (94 - 11) * t);
    }
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Battery icon that reflects the state of charge (and charging state)
  _batteryIcon(soc, charging) {
    if (charging) return 'mdi:battery-charging';
    const s = Number(soc) || 0;
    if (s >= 95) return 'mdi:battery';
    if (s >= 85) return 'mdi:battery-90';
    if (s >= 75) return 'mdi:battery-80';
    if (s >= 65) return 'mdi:battery-70';
    if (s >= 55) return 'mdi:battery-60';
    if (s >= 45) return 'mdi:battery-50';
    if (s >= 35) return 'mdi:battery-40';
    if (s >= 25) return 'mdi:battery-30';
    if (s >= 15) return 'mdi:battery-20';
    if (s >= 5) return 'mdi:battery-10';
    return 'mdi:battery-outline';
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
      return { text: '?', visible: false };
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
    if (!entityId || !this._hass) return '-';
    const stateObj = this._hass.states[entityId];
    if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') return '-';
    return stateObj.state;
  }

  _updateOverlays() {
    if (!this.shadowRoot || !this._hass) return;
    for (let i = 1; i <= 10; i++) {
      const prefix = `overlay_${i}`;
      const entity = this._config[`${prefix}_entity`];
      if (!this._config[`${prefix}_enabled`] || !entity) continue;
      const disp = this._getSensorOverlayDisplay(entity);
      const label = this._config[`${prefix}_show_label`] ? (this._config[`${prefix}_label`] || '') : undefined;
      this._updatePowerOverlay(`.power-overlay.gen-overlay-${i}`, disp.text, disp.visible, label);
    }
  }

  _renderEntityPill({ entity, icon, label, showLabel, top, left, scale, pillClass, color, iconBgClass, iconColorClass }) {
    if (!entity) return '';
    const displayState = this._getEntityDisplayState(entity);
    let iconHtml;
    if (color) {
      const rgb = this._normalizeColor(color);
      const colorStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
      iconHtml = `<div class="pill-icon" style="background: rgba(${colorStr}, 0.15); box-shadow: 0 0 8px rgba(${colorStr}, 0.3);"><ha-icon icon="${icon}" style="color: rgb(${colorStr});"></ha-icon></div>`;
    } else {
      iconHtml = `<div class="pill-icon ${iconBgClass}"><ha-icon icon="${icon}" class="${iconColorClass}"></ha-icon></div>`;
    }
    return `
      <div class="pill ${pillClass}" style="top: ${top}%; left: ${left}%; --pill-scale: ${scale};" data-entity="${entity}">
        ${iconHtml}
        <div class="pill-content">
          <span class="pill-val">${displayState}</span>
          ${showLabel && label ? `<span class="pill-label">${label}</span>` : ''}
        </div>
      </div>
    `;
  }

  _renderExtraPillByKey(key, pillClass) {
    return this._renderEntityPill({
      entity: this._config[`${key}_entity`],
      icon: this._config[`${key}_icon`] || 'mdi:information-outline',
      label: this._config[`${key}_label`] || '',
      showLabel: this._config[`${key}_show_label`],
      top: this._config[`${key}_top`] ?? 8,
      left: this._config[`${key}_left`] ?? 65,
      scale: this._config[`${key}_scale`] ?? 1.0,
      pillClass,
      color: this._config[`${key}_color`]
    });
  }

  _renderStatusPill() {
    return this._renderEntityPill({
      entity: this._config.status_entity,
      icon: this._config.status_icon || 'mdi:battery-sync',
      label: this._config.status_label || '',
      showLabel: this._config.status_show_label,
      top: this._config.status_pill_top ?? 12,
      left: this._config.status_pill_left ?? 78,
      scale: this._config.status_pill_scale ?? 1.0,
      pillClass: 'pill-status',
      iconBgClass: 'bg-status',
      iconColorClass: 'color-status'
    });
  }

  _renderExtraPills() {
    return this._renderExtraPillByKey('extra_pill', 'pill-extra')
      + this._renderExtraPillByKey('extra_pill_2', 'pill-extra-2');
  }

  _renderAllOverlays() {
    let html = '';
    for (let i = 1; i <= 10; i++) {
      const prefix = `overlay_${i}`;
      const entity = this._config[`${prefix}_entity`];
      if (!this._config[`${prefix}_enabled`] || !entity) continue;
      const disp = this._getSensorOverlayDisplay(entity);
      html += this._buildPowerOverlay({
        extraClass: `gen-overlay-${i}`,
        prefix,
        value: disp.text,
        visible: disp.visible
      });
    }
    return html;
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
      const dimWhenOff = this._config[`custom_pill_${i}_dim_when_off`] === true;
      const breatheWhenOn = this._config[`custom_pill_${i}_breathe_when_on`] === true;
      const isInactive = dimWhenOff && this._isEntityOffOrDisabled(entity);
      const isActive = breatheWhenOn && this._isEntityOnOrActive(entity);
      
      // Get entity value
      const { value, unit } = this._getCustomPillValue(entity);
      const displayValue = value + (unit ? ' ' + unit : '');
      const iconClasses = ['pill-icon'];
      if (isInactive) iconClasses.push('bg-inactive', 'custom-pill-dimmed');
      if (isActive) iconClasses.push('custom-pill-breathe');
      const iconWrapStyle = isInactive
        ? ''
        : `style="--pill-r: ${color.r}; --pill-g: ${color.g}; --pill-b: ${color.b}; background: rgba(${colorStr}, 0.15);${isActive ? '' : ` box-shadow: 0 0 8px rgba(${colorStr}, 0.3);`}"`;
      const iconEl = isInactive
        ? `<ha-icon icon="${icon}" class="color-inactive"></ha-icon>`
        : `<ha-icon icon="${icon}" style="color: rgb(${colorStr});"></ha-icon>`;
      
      html += `
          <div class="pill pill-custom-${i}" style="top: ${top}%; left: ${left}%; --pill-scale: ${scale};" data-entity="${entity}" data-custom-pill="${i}">
            <div class="${iconClasses.join(' ')}" ${iconWrapStyle}>${iconEl}</div>
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
      // Brief cross-fade so value changes feel smooth
      el.classList.remove('value-flash');
      void el.offsetWidth; // force reflow to restart the animation
      el.classList.add('value-flash');
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
      const weatherCycleButton = e.target.closest('[data-weather-cycle]');
      if (weatherCycleButton) {
        e.stopPropagation();
        this._cycleManualWeatherMode();
        return;
      }

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

  // Generate animated flow path with real SVG filter glow + travelling particles
  _renderFlow(path, color, active, reverse = false, className = '') {
    const direction = reverse ? 'reverse' : '';
    const display = active ? 'block' : 'none';
    const beamColor = Array.isArray(this._config.beam_color) && this._config.beam_color.length === 3
      ? `rgb(${this._config.beam_color.join(',')})`
      : color;
    const beamSize = this._config.beam_size ?? 1.2;
    const beamCoreSize = Math.max(0.2, beamSize * 0.5);
    const particleColor = Array.isArray(this._config.particle_color) && this._config.particle_color.length === 3
      ? `rgb(${this._config.particle_color.join(',')})`
      : 'rgba(255,255,255,0.9)';
    const particleSize = this._config.particle_size ?? 3;
    const particleSpeed = this._config.particle_speed ?? 3;
    const pathId = `flow-path-${className}`;
    // Create unique filter ID based on color
    const filterId = `glow-${color.replace('#', '').replace(/[^a-zA-Z0-9]/g, '')}`;
    
    return `
      <g class="flow-group ${className}" style="display: ${display};">
        <!-- Background track (pulsing, async) -->
        <path id="${pathId}" d="${path}" fill="none" stroke="${color}" stroke-width="0.5" stroke-linecap="round" class="flow-track" />
        
        <!-- Glowing animated beam with SVG filter -->
        <path d="${path}" fill="none" stroke="${beamColor}" stroke-width="${beamSize}" stroke-opacity="0.9" stroke-linecap="round" 
              class="flow-beam ${direction}" filter="url(#strokeGlow)" />
        
        <!-- Bright core with soft edges -->
        <path d="${path}" fill="none" stroke="${beamColor}" stroke-width="${beamCoreSize}" stroke-opacity="0.85" stroke-linecap="round" 
              class="flow-beam ${direction}" filter="url(#softEdge)" />
        
        ${active ? `
          <circle class="flow-particle" r="${particleSize}" fill="${particleColor}" opacity="0.95">
            <animateMotion dur="${particleSpeed}s" repeatCount="indefinite" rotate="auto">
              <mpath xlink:href="#${pathId}" />
            </animateMotion>
          </circle>
          <circle class="flow-particle" r="${particleSize}" fill="${particleColor}" opacity="0.7">
            <animateMotion begin="${particleSpeed / 2}s" dur="${particleSpeed}s" repeatCount="indefinite" rotate="auto">
              <mpath xlink:href="#${pathId}" />
            </animateMotion>
          </circle>
        ` : ''}
      </g>
    `;
  }

  // Get weather icon based on conditions
  _getWeatherIcon(weatherData) {
    if (!weatherData.enabled) return 'mdi:weather-sunny';
    
    const { weatherType, isNight } = weatherData;
    
    if (isNight) {
      if (weatherType === 'cloudy') return 'mdi:weather-night-partly-cloudy';
      if (weatherType === 'partlycloudy') return 'mdi:weather-night-partly-cloudy';
      if (weatherType === 'rainy') return 'mdi:weather-rainy';
      if (weatherType === 'snowy') return 'mdi:weather-snowy';
      if (weatherType === 'hail') return 'mdi:weather-hail';
      if (weatherType === 'foggy') return 'mdi:weather-fog';
      if (weatherType === 'stormy') return 'mdi:weather-lightning';
      if (weatherType === 'windy') return 'mdi:weather-windy';
      return 'mdi:weather-night';
    } else {
      if (weatherType === 'cloudy') return 'mdi:weather-cloudy';
      if (weatherType === 'partlycloudy') return 'mdi:weather-partly-cloudy';
      if (weatherType === 'rainy') return 'mdi:weather-rainy';
      if (weatherType === 'snowy') return 'mdi:weather-snowy';
      if (weatherType === 'hail') return 'mdi:weather-hail';
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
      'cloudy': 'Bewoelkt',
      'partlycloudy': 'Teilweise bewoelkt',
      'rainy': 'Regen',
      'snowy': 'Schnee',
      'hail': 'Hagel',
      'foggy': 'Nebel',
      'stormy': 'Gewitter',
      'windy': 'Windig'
    } : {
      'sunny': 'Sunny',
      'clear': 'Clear',
      'cloudy': 'Cloudy',
      'partlycloudy': 'Partly Cloudy',
      'rainy': 'Rain',
      'snowy': 'Snow',
      'hail': 'Hail',
      'foggy': 'Fog',
      'stormy': 'Storm',
      'windy': 'Windy'
    };
    
    // At night, a "sunny" condition from the weather entity really means clear sky
    let type = weatherData.weatherType;
    if (weatherData.isNight && type === 'sunny') {
      type = 'clear';
    }

    return labels[type] || type;
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

  _getManualWeatherCycleOptions() {
    return [
      { mode: 'auto', label: 'Auto', icon: 'mdi:weather-sunny-alert' },
      { mode: 'day', weather: 'sunny', label: 'Sunny', icon: 'mdi:weather-sunny' },
      { mode: 'day', weather: 'clear', label: 'Clear Day', icon: 'mdi:white-balance-sunny' },
      { mode: 'day', weather: 'partlycloudy', label: 'Partly Cloudy', icon: 'mdi:weather-partly-cloudy' },
      { mode: 'day', weather: 'cloudy', label: 'Cloudy', icon: 'mdi:weather-cloudy' },
      { mode: 'day', weather: 'rainy', label: 'Rain', icon: 'mdi:weather-rainy' },
      { mode: 'day', weather: 'stormy', label: 'Storm', icon: 'mdi:weather-lightning' },
      { mode: 'day', weather: 'snowy', label: 'Snow', icon: 'mdi:weather-snowy' },
      { mode: 'day', weather: 'hail', label: 'Hail', icon: 'mdi:weather-hail' },
      { mode: 'day', weather: 'foggy', label: 'Fog', icon: 'mdi:weather-fog' },
      { mode: 'day', weather: 'windy', label: 'Windy', icon: 'mdi:weather-windy' },
      { mode: 'night', weather: 'clear', label: 'Clear Night', icon: 'mdi:weather-night' },
      { mode: 'night', weather: 'partlycloudy', label: 'Night Clouds', icon: 'mdi:weather-night-partly-cloudy' },
      { mode: 'night', weather: 'cloudy', label: 'Cloudy Night', icon: 'mdi:weather-cloudy' },
      { mode: 'night', weather: 'rainy', label: 'Night Rain', icon: 'mdi:weather-rainy' },
      { mode: 'night', weather: 'stormy', label: 'Night Storm', icon: 'mdi:weather-lightning' },
      { mode: 'night', weather: 'snowy', label: 'Night Snow', icon: 'mdi:weather-snowy' },
      { mode: 'night', weather: 'hail', label: 'Night Hail', icon: 'mdi:weather-hail' },
      { mode: 'night', weather: 'foggy', label: 'Night Fog', icon: 'mdi:weather-fog' },
      { mode: 'night', weather: 'windy', label: 'Night Wind', icon: 'mdi:weather-windy' }
    ];
  }

  _getCurrentManualWeatherCycleIndex(options = this._getManualWeatherCycleOptions()) {
    const mode = this._config.manual_weather_mode || 'auto';
    if (mode === 'day') {
      const weather = this._config.manual_weather_day || 'sunny';
      return Math.max(0, options.findIndex((option) => option.mode === 'day' && option.weather === weather));
    }
    if (mode === 'night') {
      const weather = this._config.manual_weather_night || 'clear';
      return Math.max(0, options.findIndex((option) => option.mode === 'night' && option.weather === weather));
    }
    return 0;
  }

  _getCurrentManualWeatherCycleOption() {
    const options = this._getManualWeatherCycleOptions();
    return options[this._getCurrentManualWeatherCycleIndex(options)] || options[0];
  }

  _cycleManualWeatherMode() {
    const options = this._getManualWeatherCycleOptions();
    const next = options[(this._getCurrentManualWeatherCycleIndex(options) + 1) % options.length];

    this._config.enable_weather_effects = true;
    this._config.manual_weather_mode = next.mode;
    if (next.mode === 'day') {
      this._config.manual_weather_day = next.weather;
    } else if (next.mode === 'night') {
      this._config.manual_weather_night = next.weather;
    }
    this._lastWeatherKey = null;
    this._fireConfigChanged();
    this.render();
  }

  _fireConfigChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true
    }));
  }

  _renderWeatherCycleButton() {
    if (!this._config.weather_cycle_button_show) return '';

    const current = this._getCurrentManualWeatherCycleOption();
    const icon = this._config.weather_cycle_button_icon || current.icon || 'mdi:weather-partly-cloudy';
    const isAuto = current.mode === 'auto';
    const top = this._config.weather_cycle_button_top ?? 18;
    const left = this._config.weather_cycle_button_left ?? 88;
    const scale = this._config.weather_cycle_button_scale ?? 1.0;
    const iconOnlyClass = isAuto ? '' : ' pill-icon-only';

    return `
      <div class="pill pill-weather-cycle${iconOnlyClass}" style="top: ${top}%; left: ${left}%; --pill-scale: ${scale};" data-weather-cycle>
        <div class="pill-icon bg-weather-cycle">
          <ha-icon icon="${icon}" class="color-weather-cycle"></ha-icon>
        </div>
        ${isAuto ? `
        <div class="pill-content">
          <span class="pill-val">${current.label}</span>
        </div>` : ''}
      </div>
    `;
  }

  // Compute daytime sun position (0..1 = left..right) and a detailed 8-phase sun palette
  _getSunVisualState(sunState, isNight) {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const az = Number(sunState?.attributes?.azimuth);
    let progress = 0.5;

    // Prefer solar azimuth when available: east (~90) -> west (~270)
    if (!Number.isNaN(az)) {
      progress = Math.max(0, Math.min(1, (az - 90) / 180));
    } else {
      // Fallback by local daytime clock
      progress = Math.max(0, Math.min(1, (hour - 6) / 12));
    }

    let phase = 'noon';
    if (isNight) {
      phase = 'night';
    } else {
      const phases = [
        'sunrise_1',   // pre-sunrise glow
        'sunrise_2',   // soft pink/peach
        'morning',     // warmer morning yellow
        'late_morning',
        'noon',        // brightest yellow
        'afternoon',   // starting to warm
        'sunset_1',    // orange/gold
        'sunset_2'     // red/purple/dusty blue
      ];
      const idx = Math.max(0, Math.min(7, Math.floor(progress * 8)));
      phase = phases[idx];
    }

    return { progress, phase };
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
    if (!this._config.enable_weather_effects || !this._hass) {
      return { enabled: false };
    }

    // Manual override - force a specific day or night effect (no weather entity needed)
    const manualMode = this._config.manual_weather_mode || 'auto';
    if (manualMode === 'day' || manualMode === 'night') {
      const isNight = manualMode === 'night';
      const sunState = this._hass.states['sun.sun'];
      const sunVisual = this._getSunVisualState(sunState, isNight);
      const manualPhase = this._config.manual_weather_day_phase || 'auto';
      const weatherType = isNight
        ? (this._config.manual_weather_night || 'clear')
        : (this._config.manual_weather_day || 'sunny');
      const phase = isNight ? 'night' : (manualPhase === 'auto' ? sunVisual.phase : manualPhase);
      let progress = sunVisual.progress;
      if (!isNight && manualPhase !== 'auto') {
        const phaseProgress = {
          sunrise_1: 0.06,
          sunrise_2: 0.18,
          morning: 0.31,
          late_morning: 0.44,
          noon: 0.56,
          afternoon: 0.69,
          sunset_1: 0.82,
          sunset_2: 0.94
        };
        progress = phaseProgress[manualPhase] ?? 0.56;
      }
      let cloudCoverage = null;
      if (this._config.cloud_coverage_entity) {
        const cloudState = this._hass.states[this._config.cloud_coverage_entity];
        if (cloudState) cloudCoverage = parseFloat(cloudState.state) || 0;
      }
      return {
        enabled: true,
        weatherType,
        isNight,
        isSunrise: false,
        isSunset: false,
        sunProgress: progress,
        sunPhase: phase,
        condition: weatherType,
        cloudCoverage
      };
    }

    // Auto mode requires a weather entity
    if (!this._config.weather_entity) {
      return { enabled: false };
    }

    // Get weather state
    const weatherState = this._hass.states[this._config.weather_entity];
    const weatherCondition = (weatherState?.state || 'clear').toLowerCase();

    // Get sun state for day/night
    const sunState = this._hass.states['sun.sun'];
    const isNight = sunState?.state === 'below_horizon';
    const sunVisual = this._getSunVisualState(sunState, isNight);
    
    // Get sun elevation for sunrise/sunset effects
    const sunElevation = sunState?.attributes?.elevation || 0;
    const isSunrise = sunElevation > -10 && sunElevation < 10 && !isNight;
    const isSunset = sunElevation > -10 && sunElevation < 10 && isNight;

    // Map HA weather states to animation types
    let weatherType = 'clear';
    if (weatherCondition.includes('hail')) {
      weatherType = 'hail';
    } else if (weatherCondition.includes('rain') || weatherCondition.includes('drizzle') || weatherCondition.includes('shower')) {
      weatherType = 'rainy';
    } else if (weatherCondition.includes('snow') || weatherCondition.includes('sleet')) {
      weatherType = 'snowy';
    } else if (weatherCondition.includes('fog') || weatherCondition.includes('mist') || weatherCondition.includes('haze')) {
      weatherType = 'foggy';
    } else if (weatherCondition.includes('partlycloudy') || weatherCondition.includes('partly')) {
      weatherType = 'partlycloudy';
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
      sunProgress: sunVisual.progress,
      sunPhase: sunVisual.phase,
      condition: weatherCondition,
      cloudCoverage
    };
  }

  // Render weather effects HTML
  _renderWeatherEffects(weatherData) {
    if (!weatherData.enabled) return '';

    let html = '<div class="weather-container">';
    const { weatherType, isNight, isSunrise, isSunset } = weatherData;
    const sunProgress = Math.max(0, Math.min(1, Number(weatherData.sunProgress) || 0.5));
    const sunPhase = weatherData.sunPhase || (isNight ? 'night' : 'day');
    const sunX = `${10 + sunProgress * 80}%`;
    // Rotate rays so they always point toward the house center (~55% x)
    // (sign intentionally flipped to match the visual orientation of the conic beam mask)
    const beamAngle = (sunProgress - 0.5) * 34; // left sun => tilt right, middle => down, right sun => tilt left

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
        const delay = Math.random() * 12;
        const duration = 10 + Math.random() * 10;
        const size = 3 + Math.random() * 3;
        html += `<div class="snow-flake" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s; width: ${size}px; height: ${size}px;"></div>`;
      }
      // Light snow accumulation around the base of the house
      html += `
        <div class="snow-buildup snow-buildup-1"></div>
        <div class="snow-buildup snow-buildup-2"></div>
        <div class="snow-buildup snow-buildup-3"></div>
      `;
    }

    // Hail effect (fast bouncing ice pellets)
    if (weatherType === 'hail') {
      for (let i = 0; i < 20; i++) {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const duration = 0.5 + Math.random() * 0.3;
        const size = 4 + Math.random() * 3;
        html += `<div class="hail-stone" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s; width: ${size}px; height: ${size}px;"></div>`;
      }
    }

    // Fog effect
    if (weatherType === 'foggy') {
      html += `<div class="fog-layer fog-1"></div>`;
      html += `<div class="fog-layer fog-2"></div>`;
      html += `<div class="fog-layer fog-3"></div>`;
    }

    // Wind effect (sweeping streaks + drifting leaves)
    if (weatherType === 'windy') {
      for (let i = 0; i < 6; i++) {
        const top = 10 + Math.random() * 60;
        const delay = Math.random() * 4;
        const duration = 2.5 + Math.random() * 2;
        const width = 40 + Math.random() * 60;
        html += `<div class="wind-streak" style="top: ${top}%; width: ${width}px; animation-delay: ${delay}s; animation-duration: ${duration}s;"></div>`;
      }
      for (let i = 0; i < 4; i++) {
        const top = 20 + Math.random() * 55;
        const delay = Math.random() * 5;
        const duration = 4 + Math.random() * 3;
        html += `<div class="wind-leaf" style="top: ${top}%; animation-delay: ${delay}s; animation-duration: ${duration}s;"></div>`;
      }
    }

    // Lightning effect for storms
    if (weatherType === 'stormy') {
      html += `<div class="lightning"></div>`;
    }

    // Night effects: stars and moon
    if (isNight) {
      // Stars - only in top area, with stronger twinkle
      html += '<div class="stars-container">';
      for (let i = 0; i < 34; i++) {
        const left = Math.random() * 100;
        const top = Math.random() * 24; // Keep stars mostly near the top
        const size = 1 + Math.random() * 1.5;
        const delay = Math.random() * 3;
        const duration = 2 + Math.random() * 4;
        const brightness = 0.15 + Math.random() * 0.7;
        html += `<div class="star" style="left: ${left}%; top: ${top}%; width: ${size}px; height: ${size}px; animation-delay: ${delay}s; animation-duration: ${duration}s; opacity: ${brightness};"></div>`;
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
      // Day effects: sun glow - more subtle (also peeks through on partly cloudy)
      if (weatherType === 'sunny' || weatherType === 'clear' || weatherType === 'partlycloudy') {
        html += `<div class="sun-glow sun-phase-${sunPhase}" style="--sun-x: ${sunX};"></div>`;
      }
      // Soft glowing sun + downward light rays on clear/sunny days
      if (weatherType === 'sunny' || weatherType === 'clear') {
        html += `<div class="sun-beams sun-phase-${sunPhase}" style="--sun-x: ${sunX}; --beam-angle: ${beamAngle}deg;"></div><div class="sun sun-phase-${sunPhase}" style="--sun-x: ${sunX};"></div>`;
      }
    }

    // Rain puddle / wet-ground shimmer at the base during rain or storms
    if (weatherType === 'rainy' || weatherType === 'stormy') {
      html += '<div class="rain-puddle"></div>';
    }

    // Sunrise/Sunset gradient overlay
    if (isSunrise) {
      html += '<div class="sunrise-overlay"></div>';
    } else if (isSunset) {
      html += '<div class="sunset-overlay"></div>';
    }

    // Clouds based on weather type / coverage.
    // - Cloudy: lots of clouds
    // - Partly cloudy: moderate clouds
    // - Rain/Storm: clouds always present
    // - Night: consistent cloud amount in all scenarios
    const cloudCoverage = weatherData.cloudCoverage;
    const isPrecip = weatherType === 'rainy' || weatherType === 'stormy' || weatherType === 'snowy' || weatherType === 'hail';
    const showClouds = isNight || weatherType === 'cloudy' || weatherType === 'partlycloudy' || isPrecip ||
                       (cloudCoverage !== null && cloudCoverage > 0);
    
    if (showClouds) {
      // Determine cloud count based on weather type
      let staticCount = 3;
      let movingCount = 8;

      if (weatherType === 'partlycloudy') {
        staticCount = 2;
        movingCount = 5;
      } else if (weatherType === 'rainy') {
        staticCount = 3;
        movingCount = 7;
      } else if (weatherType === 'stormy') {
        staticCount = 3;
        movingCount = 8;
      } else if (weatherType === 'snowy') {
        staticCount = 2;
        movingCount = 6;
      } else if (weatherType === 'hail') {
        staticCount = 2;
        movingCount = 6;
      }
      
      // Night mode: same cloud amount across all scenarios
      if (isNight) {
        staticCount = 3;
        movingCount = 8;
      } else if (cloudCoverage !== null) {
        // Scale clouds based on coverage percentage
        if (cloudCoverage <= 20) {
          staticCount = 0; movingCount = 2;
        } else if (cloudCoverage <= 40) {
          staticCount = 1; movingCount = 3;
        } else if (cloudCoverage <= 55) {
          staticCount = 2; movingCount = 4;
        } else if (cloudCoverage <= 70) {
          staticCount = 2; movingCount = 5;
        } else if (cloudCoverage <= 85) {
          staticCount = 3; movingCount = 6;
        } else {
          staticCount = 3; movingCount = 8;
        }
      }
      
      // Dim clouds at night
      const nightCls = isNight ? ' cloud-night' : '';
      html += '<!-- Clouds based on coverage -->';
      // Static clouds
      if (staticCount >= 1) html += `<div class="cloud cloud-static cloud-static-1${nightCls}"></div>`;
      if (staticCount >= 2) html += `<div class="cloud cloud-static cloud-static-2${nightCls}"></div>`;
      if (staticCount >= 3) html += `<div class="cloud cloud-static cloud-static-3${nightCls}"></div>`;
      // Moving clouds (scroll across)
      for (let c = 1; c <= movingCount && c <= 8; c++) {
        html += `<div class="cloud cloud-moving cloud-${c}${nightCls}"></div>`;
      }
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

      /* Wet-ground shimmer at the base during rain */
      .rain-puddle {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 24%;
        background:
          linear-gradient(to top, rgba(130, 160, 200, 0.22) 0%, rgba(130, 160, 200, 0.08) 45%, transparent 100%);
        -webkit-mask-image: linear-gradient(to top, #000 0%, transparent 100%);
        mask-image: linear-gradient(to top, #000 0%, transparent 100%);
        pointer-events: none;
        z-index: 1;
        animation: puddle-shimmer 5s ease-in-out infinite;
      }
      .rain-puddle::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(100deg, transparent 30%, rgba(190, 215, 245, 0.18) 50%, transparent 70%);
        transform: translateX(-40%);
        animation: puddle-sheen 7s ease-in-out infinite;
      }
      @keyframes puddle-shimmer {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.9; }
      }
      @keyframes puddle-sheen {
        0%, 100% { transform: translateX(-40%); }
        50% { transform: translateX(40%); }
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

      /* Snow accumulation around the bottom area/house base */
      .snow-buildup {
        position: absolute;
        bottom: 0;
        pointer-events: none;
        z-index: 1;
        background: linear-gradient(to top, rgba(245, 250, 255, 0.82), rgba(230, 240, 250, 0.45), transparent 92%);
        filter: blur(0.6px);
      }
      .snow-buildup-1 {
        left: 8%;
        width: 34%;
        height: 14%;
        border-radius: 48% 52% 0 0;
      }
      .snow-buildup-2 {
        left: 30%;
        width: 42%;
        height: 12%;
        border-radius: 56% 44% 0 0;
      }
      .snow-buildup-3 {
        left: 64%;
        width: 26%;
        height: 10%;
        border-radius: 52% 48% 0 0;
      }

      /* Hail Animation - fast, hard ice pellets */
      .hail-stone {
        position: absolute;
        top: 0;
        background: radial-gradient(circle at 35% 30%, #ffffff, #cdd6e0);
        border-radius: 50%;
        opacity: 0;
        will-change: transform, opacity;
        contain: layout style paint;
        box-shadow: 0 0 3px rgba(255, 255, 255, 0.6);
        animation: hail-fall linear infinite;
      }
      @keyframes hail-fall {
        0% { transform: translateY(-20px) translateX(0); opacity: 0; }
        5% { opacity: 0.95; }
        85% { opacity: 0.95; }
        100% { transform: translateY(100vh) translateX(-15px); opacity: 0; }
      }

      /* Wind Animation - sweeping streaks + drifting leaves */
      .wind-streak {
        position: absolute;
        left: -120px;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        border-radius: 2px;
        opacity: 0;
        will-change: transform, opacity;
        animation: wind-blow linear infinite;
      }
      @keyframes wind-blow {
        0% { transform: translateX(0); opacity: 0; }
        10% { opacity: 0.7; }
        90% { opacity: 0.7; }
        100% { transform: translateX(120vw); opacity: 0; }
      }
      .wind-leaf {
        position: absolute;
        left: -20px;
        width: 8px;
        height: 8px;
        background: rgba(155, 185, 120, 0.75);
        border-radius: 0 50% 50% 50%;
        opacity: 0;
        will-change: transform, opacity;
        animation: wind-leaf-blow linear infinite;
      }
      @keyframes wind-leaf-blow {
        0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.85; }
        50% { transform: translate(60vw, -15px) rotate(180deg); }
        90% { opacity: 0.85; }
        100% { transform: translate(120vw, 12px) rotate(360deg); opacity: 0; }
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
        box-shadow: 0 0 6px rgba(255, 255, 255, 0.45);
      }
      @keyframes star-twinkle {
        0%, 100% { opacity: 0.18; transform: scale(0.85); }
        35% { opacity: 0.95; transform: scale(1.25); }
        70% { opacity: 0.35; transform: scale(0.95); }
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
        top: 40px;
        left: var(--sun-x, 50%);
        transform: translateX(-50%);
        width: 190px;
        height: 190px;
        background: radial-gradient(
          circle at center,
          rgba(255, 205, 60, 0.32) 0%,
          rgba(255, 185, 55, 0.18) 30%,
          rgba(255, 165, 50, 0.09) 50%,
          transparent 72%
        );
        filter: blur(25px);
        z-index: 0;
        animation: sun-pulse 10s ease-in-out infinite;
      }
      @keyframes sun-pulse {
        0%, 100% { transform: scale(1); opacity: 0.9; }
        50% { transform: scale(1.07); opacity: 1; }
      }

      /* Soft glowing sun orb (daytime counterpart to the moon) */
      .sun {
        position: absolute;
        top: 42px;
        left: var(--sun-x, 50%);
        transform: translateX(-50%);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 248, 214, 0.95) 0%,
          rgba(255, 224, 140, 0.7) 38%,
          rgba(255, 198, 96, 0.28) 68%,
          transparent 100%);
        filter: blur(1px);
        box-shadow:
          0 0 28px rgba(255, 214, 130, 0.6),
          0 0 64px rgba(255, 196, 96, 0.38),
          0 0 110px rgba(255, 184, 76, 0.22);
        z-index: 0;
        animation: sun-breathe 7s ease-in-out infinite;
      }
      /* Downward soft "god rays" fanning onto the panels */
      .sun-beams {
        position: absolute;
        top: 20px;
        left: var(--sun-x, 50%);
        transform: translateX(-50%) rotate(var(--beam-angle, 0deg));
        transform-origin: 50% 12%;
        width: 280px;
        height: 280px;
        background: conic-gradient(from 180deg at 50% 12%,
          transparent 126deg,
          rgba(255, 226, 150, 0.14) 138deg,
          transparent 148deg,
          rgba(255, 222, 140, 0.10) 164deg,
          transparent 176deg,
          rgba(255, 226, 150, 0.14) 192deg,
          transparent 204deg,
          rgba(255, 220, 138, 0.09) 220deg,
          transparent 234deg);
        filter: blur(7px);
        pointer-events: none;
        z-index: 0;
        mix-blend-mode: screen;
        animation: sun-ray-shimmer 8s ease-in-out infinite;
      }
      @keyframes sun-breathe {
        0%, 100% { transform: scale(1); opacity: 0.92; }
        50% { transform: scale(1.05); opacity: 1; }
      }
      @keyframes sun-ray-shimmer {
        0%, 100% { opacity: 0.45; }
        50% { opacity: 0.85; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sun-beams { animation: none; }
      }

      /* Sun color by daytime phase */
      .sun-phase-sunrise_1.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(232, 244, 255, 0.96) 0%,
          rgba(255, 198, 188, 0.70) 42%,
          rgba(255, 170, 150, 0.30) 70%,
          transparent 100%);
        box-shadow:
          0 0 26px rgba(196, 216, 255, 0.55),
          0 0 58px rgba(255, 176, 186, 0.34),
          0 0 96px rgba(240, 168, 206, 0.20);
      }
      .sun-phase-sunrise_1.sun-glow {
        background: radial-gradient(
          circle at center,
          rgba(186, 216, 255, 0.30) 0%,
          rgba(246, 190, 196, 0.22) 30%,
          rgba(230, 184, 220, 0.12) 52%,
          transparent 74%
        );
      }
      .sun-phase-sunrise_1.sun-beams {
        background: conic-gradient(from 180deg at 50% 12%,
          transparent 126deg,
          rgba(210, 228, 255, 0.15) 138deg,
          transparent 148deg,
          rgba(255, 188, 196, 0.12) 164deg,
          transparent 176deg,
          rgba(238, 192, 224, 0.15) 192deg,
          transparent 204deg,
          rgba(202, 218, 248, 0.11) 220deg,
          transparent 234deg);
      }

      .sun-phase-sunrise_2.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 236, 206, 0.96) 0%,
          rgba(255, 190, 142, 0.70) 42%,
          rgba(230, 180, 222, 0.30) 70%,
          transparent 100%);
        box-shadow:
          0 0 24px rgba(255, 192, 144, 0.60),
          0 0 56px rgba(238, 170, 220, 0.35),
          0 0 94px rgba(212, 172, 232, 0.20);
      }
      .sun-phase-sunrise_2.sun-glow {
        background: radial-gradient(
          circle at center,
          rgba(255, 196, 146, 0.30) 0%,
          rgba(248, 176, 146, 0.18) 30%,
          rgba(214, 168, 222, 0.10) 52%,
          transparent 74%
        );
      }
      .sun-phase-sunrise_2.sun-beams {
        background: conic-gradient(from 180deg at 50% 12%,
          transparent 126deg,
          rgba(255, 202, 152, 0.13) 138deg,
          transparent 148deg,
          rgba(248, 184, 152, 0.11) 164deg,
          transparent 176deg,
          rgba(232, 176, 222, 0.13) 192deg,
          transparent 204deg,
          rgba(216, 178, 232, 0.10) 220deg,
          transparent 234deg);
      }

      .sun-phase-morning.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 244, 208, 0.96) 0%,
          rgba(255, 210, 138, 0.72) 42%,
          rgba(255, 182, 104, 0.30) 70%,
          transparent 100%);
      }
      .sun-phase-late_morning.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 248, 214, 0.96) 0%,
          rgba(255, 220, 142, 0.72) 42%,
          rgba(255, 194, 106, 0.30) 70%,
          transparent 100%);
      }
      .sun-phase-noon.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 250, 220, 0.98) 0%,
          rgba(255, 226, 136, 0.74) 42%,
          rgba(255, 198, 94, 0.30) 70%,
          transparent 100%);
      }
      .sun-phase-afternoon.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 244, 204, 0.96) 0%,
          rgba(255, 208, 128, 0.72) 42%,
          rgba(255, 170, 98, 0.30) 70%,
          transparent 100%);
      }

      .sun-phase-sunset_1.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 228, 184, 0.96) 0%,
          rgba(255, 168, 106, 0.70) 42%,
          rgba(234, 126, 88, 0.30) 70%,
          transparent 100%);
      }
      .sun-phase-sunset_1.sun-glow {
        background: radial-gradient(
          circle at center,
          rgba(255, 184, 118, 0.30) 0%,
          rgba(238, 146, 108, 0.18) 30%,
          rgba(224, 126, 96, 0.10) 52%,
          transparent 74%
        );
      }
      .sun-phase-sunset_1.sun-beams {
        background: conic-gradient(from 180deg at 50% 12%,
          transparent 126deg,
          rgba(255, 186, 126, 0.13) 138deg,
          transparent 148deg,
          rgba(236, 142, 112, 0.11) 164deg,
          transparent 176deg,
          rgba(255, 196, 132, 0.13) 192deg,
          transparent 204deg,
          rgba(218, 132, 118, 0.10) 220deg,
          transparent 234deg);
      }

      .sun-phase-sunset_2.sun {
        background: radial-gradient(circle at 50% 50%,
          rgba(255, 214, 170, 0.94) 0%,
          rgba(228, 138, 98, 0.68) 40%,
          rgba(174, 112, 154, 0.32) 70%,
          transparent 100%);
      }
      .sun-phase-sunset_2.sun-glow {
        background: radial-gradient(
          circle at center,
          rgba(230, 152, 110, 0.28) 0%,
          rgba(190, 120, 150, 0.18) 30%,
          rgba(136, 146, 188, 0.12) 52%,
          transparent 234deg);
      }
      .sun-phase-sunset_2.sun-beams {
        background: conic-gradient(from 180deg at 50% 12%,
          transparent 126deg,
          rgba(228, 156, 116, 0.12) 138deg,
          transparent 148deg,
          rgba(190, 128, 156, 0.11) 164deg,
          transparent 176deg,
          rgba(214, 144, 126, 0.12) 192deg,
          transparent 204deg,
          rgba(140, 152, 192, 0.11) 220deg,
          transparent 234deg);
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

      /* Lightning Effect - flash from the top with thunder glow */
      .lightning {
        position: absolute;
        inset: 0;
        background: radial-gradient(140% 90% at 50% -10%, rgba(235, 242, 255, 1) 0%, rgba(190, 215, 255, 1) 35%, transparent 70%);
        opacity: 0;
        animation: lightning-flash 6s infinite;
        z-index: 1;
        pointer-events: none;
        mix-blend-mode: screen;
      }
      @keyframes lightning-flash {
        0%, 84%, 100% { opacity: 0; }
        85% { opacity: 0.65; }
        86% { opacity: 0.1; }
        88% { opacity: 0.9; }
        90% { opacity: 0.25; }
        92% { opacity: 0.55; }
        94% { opacity: 0; }
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
      .cloud-5 {
        width: 55px; height: 20px;
        top: 9%; left: -75px;
        animation-duration: 70s;
        animation-delay: -10s;
        opacity: 0.35;
      }
      .cloud-5::before { width: 28px; height: 28px; top: -14px; left: 11px; }
      .cloud-5::after { width: 33px; height: 33px; top: -17px; left: 27px; }
      .cloud-6 {
        width: 66px; height: 24px;
        top: 3%; left: -95px;
        animation-duration: 90s;
        animation-delay: -45s;
        opacity: 0.28;
      }
      .cloud-6::before { width: 33px; height: 33px; top: -17px; left: 14px; }
      .cloud-6::after { width: 40px; height: 40px; top: -21px; left: 33px; }
      .cloud-7 {
        width: 42px; height: 16px;
        top: 14%; left: -55px;
        animation-duration: 55s;
        animation-delay: -25s;
        opacity: 0.34;
      }
      .cloud-7::before { width: 21px; height: 21px; top: -10px; left: 8px; }
      .cloud-7::after { width: 26px; height: 26px; top: -13px; left: 19px; }
      .cloud-8 {
        width: 58px; height: 21px;
        top: 6%; left: -82px;
        animation-duration: 78s;
        animation-delay: -60s;
        opacity: 0.3;
      }
      .cloud-8::before { width: 29px; height: 29px; top: -15px; left: 12px; }
      .cloud-8::after { width: 35px; height: 35px; top: -18px; left: 28px; }
      
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

      /* Dimmed, cooler clouds at night */
      .cloud.cloud-night {
        opacity: 0.22;
        filter: blur(3px) brightness(0.5) saturate(0.7);
        background: linear-gradient(
          to bottom,
          rgba(180, 190, 210, 0.3) 0%,
          rgba(150, 160, 185, 0.2) 100%
        );
      }

      /* Night mode house dimming */
      .house-img.night-mode {
        filter: drop-shadow(0 20px 40px rgba(0,0,0,0.5)) brightness(0.55) saturate(0.85);
        transition: filter 1s ease;
      }
      
      /* Daytime sky tint - subtle blue wash at top */
      .visual-container.day-mode {
        background: linear-gradient(
          to bottom,
          rgba(125, 175, 235, 0.18) 0%,
          rgba(150, 195, 240, 0.06) 28%,
          transparent 55%
        );
        transition: background 1s ease;
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

    const particleColor = Array.isArray(this._config.particle_color) && this._config.particle_color.length === 3
      ? `rgb(${this._config.particle_color.join(',')})`
      : 'rgba(255,255,255,0.9)';

    // Battery icon based on SOC
    const batteryIcon = this._batteryIcon(batterySoc, isBatteryCharging);

    // EV / Tesla battery % for the pill ring + circle (if an entity is linked)
    const evBatteryEntity = this._config.ev_battery_entity || this._config.ev_soc_entity;
    const hasEvSoc = !!evBatteryEntity;
    const evSoc = hasEvSoc ? this._getState(evBatteryEntity, 0) : 0;

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

    // Colors (theme-aware)
    const colors = this._getThemeColors();
    const rgbStr = {
      solar: this._hexToRgbStr(colors.solar),
      grid: this._hexToRgbStr(colors.grid),
      battery: this._hexToRgbStr(colors.battery),
      home: this._hexToRgbStr(colors.home),
      ev: this._hexToRgbStr(colors.ev)
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
          --beam-animation-duration: ${this._config.beam_speed}s;
          --beam-stroke-width: ${this._config.beam_size};
          --particle-size: ${this._config.particle_size};
          --particle-animation-duration: ${this._config.particle_speed}s;
          --particle-color: ${particleColor};
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
          top: ${this._config.header_top ?? 5}%;
          left: ${this._config.header_left ?? 12}%;
          transform: translate(-50%, 0) scale(${this._config.header_scale ?? 1});
          transform-origin: top center;
          width: max-content;
          max-width: calc(100% - 16px);
          padding: 12px 16px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          z-index: 50;
          background: ${this._config.header_transparent ? 'transparent' : 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)'};
          border: none;
          box-shadow: none;
          backdrop-filter: none;
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

        .header-weather-icon {
          --mdc-icon-size: 15px;
          width: 15px;
          height: 15px;
          margin-right: 4px;
          color: rgba(255, 255, 255, 0.65);
          animation: weather-bob 3.6s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes weather-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-1.5px) rotate(-5deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .header-weather-icon { animation: none; }
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
          animation: track-pulse 1.6s ease-in-out infinite;
        }
        
        .flow-beam {
          stroke-dasharray: 25 75;
          animation: flow-animation var(--beam-animation-duration, 3s) linear infinite;
        }
        
        .flow-beam.reverse {
          stroke-dasharray: 25 75;
          animation: flow-animation-reverse var(--beam-animation-duration, 3s) linear infinite;
        }

        .flow-particle {
          opacity: 0.9;
          will-change: transform;
        }

        /* Data Pills - Inlet Style */
        .pill {
          --pill-scale: 1;
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(145deg, rgba(42, 44, 50, 0.72), rgba(16, 17, 20, 0.74));
          backdrop-filter: blur(16px) saturate(1.3);
          -webkit-backdrop-filter: blur(16px) saturate(1.3);
          border-radius: 999px;
          padding: 6px 10px 6px 6px;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.55),
            inset -1px -1px 2px rgba(255, 255, 255, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 6px 16px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-top: 1px solid rgba(255, 255, 255, 0.16);
          border-bottom: 1px solid rgba(0, 0, 0, 0.35);
          z-index: 20;
          transform: translate(-50%, -50%) scale(var(--pill-scale));
          white-space: nowrap;
          transition: all 0.3s ease;
          animation: pill-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes pill-enter {
          from { opacity: 0; translate: 0 10px; }
          to { opacity: 1; translate: 0 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pill { animation: none; }
        }
        
        .pill:hover {
          transform: translate(-50%, -50%) scale(calc(var(--pill-scale) * 1.03));
        }
        
        .pill[data-entity],
        .pill[data-custom-pill],
        .pill[data-weather-cycle] {
          cursor: pointer;
        }
        
        .pill[data-entity]:active,
        .pill[data-weather-cycle]:active {
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
          position: relative;
        }

        /* SOC arc ring around battery / EV pill icons */
        .pill-icon.soc-ring::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(
            from -90deg,
            var(--soc-color, #10B981) calc(var(--soc, 0) * 1%),
            rgba(255, 255, 255, 0.12) 0
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
          pointer-events: none;
          opacity: 0.9;
          transition: background 0.6s ease;
        }
        
        .pill-icon ha-icon {
          --mdc-icon-size: 16px;
        }

        /* SOC percentage shown inside a pill icon circle (e.g. EV) */
        .pill-icon-soc {
          font-size: 0.58rem;
          font-weight: 800;
          line-height: 1;
          font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
          letter-spacing: -0.02em;
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
          transition: color 0.4s ease;
        }

        /* Color-graded values */
        .pill-val.val-import { color: #f87171; }
        .pill-val.val-export { color: #4ade80; }
        .pill-val.val-charge { color: #4ade80; }
        .pill-val.val-discharge { color: #fbbf24; }

        /* Smooth cross-fade when a value changes */
        .value-flash { animation: value-flash 0.45s ease; }
        @keyframes value-flash {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .value-flash { animation: none; }
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

        /* Pill Icon Colors (theme-aware) */
        .bg-solar {
          background: rgba(${rgbStr.solar}, 0.15);
          box-shadow: 0 0 8px rgba(${rgbStr.solar}, 0.3);
        }
        .color-solar { color: ${colors.solar}; }
        
        .bg-grid {
          background: rgba(${rgbStr.grid}, 0.15);
          box-shadow: 0 0 8px rgba(${rgbStr.grid}, 0.3);
        }
        .color-grid { color: ${colors.grid}; }
        
        .bg-battery {
          background: rgba(${rgbStr.battery}, 0.15);
          box-shadow: 0 0 8px rgba(${rgbStr.battery}, 0.3);
        }
        .color-battery { color: ${colors.battery}; }
        
        .bg-home {
          background: rgba(${rgbStr.home}, 0.15);
          box-shadow: 0 0 8px rgba(${rgbStr.home}, 0.3);
        }
        .color-home { color: ${colors.home}; }
        
        .bg-ev {
          background: rgba(${rgbStr.ev}, 0.15);
          box-shadow: 0 0 8px rgba(${rgbStr.ev}, 0.3);
        }
        .color-ev { color: ${colors.ev}; }

        .bg-weather-cycle {
          background: rgba(96, 165, 250, 0.16);
          box-shadow: 0 0 10px rgba(96, 165, 250, 0.34);
        }
        .color-weather-cycle { color: #93c5fd; }

        .pill-weather-cycle.pill-icon-only {
          padding: 6px;
          gap: 0;
        }
        
        .bg-inactive {
          background: rgba(255, 255, 255, 0.03);
          box-shadow: none;
        }
        .color-inactive { color: rgba(255, 255, 255, 0.35); }

        /* Custom pill breathe ? uses --pill-r/g/b set on .pill-icon */
        @keyframes custom-pill-glow-breathe {
          0%, 100% {
            box-shadow:
              0 0 6px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.28),
              0 0 12px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.12);
          }
          50% {
            box-shadow:
              0 0 14px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.55),
              0 0 26px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.32);
          }
        }
        @keyframes custom-pill-icon-glow-breathe {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.45));
          }
          50% {
            filter:
              drop-shadow(0 0 5px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.9))
              drop-shadow(0 0 10px rgba(var(--pill-r), var(--pill-g), var(--pill-b), 0.5));
          }
        }
        .pill-icon.custom-pill-breathe {
          animation: custom-pill-glow-breathe 2.2s ease-in-out infinite;
        }
        .pill-icon.custom-pill-breathe ha-icon {
          animation: custom-pill-icon-glow-breathe 2.2s ease-in-out infinite;
        }

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
                <ha-icon class="header-weather-icon" icon="${this._getWeatherIcon(weatherData)}"></ha-icon>
                <span class="weather-status">${this._getDayNightLabel(weatherData.isNight)} - ${this._getWeatherLabel(weatherData)}</span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Main Visual -->
        <div class="visual-container ${weatherData.enabled ? (weatherData.isNight ? 'night-mode' : 'day-mode') : ''}">
          ${weatherData.enabled ? this._renderWeatherEffects(weatherData) : ''}
          <img src="${houseImg}" class="house-img ${weatherData.enabled && weatherData.isNight ? 'night-mode' : ''}" alt="Energy Home" />
          <div class="bottom-gradient"></div>

          <!-- SVG Flows -->
          <svg class="svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns:xlink="http://www.w3.org/1999/xlink">
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
              <span class="pill-val ${isGridExport ? 'val-export' : isGridImport ? 'val-import' : ''}">${this._formatPower(gridPowerDisplay)}</span>
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
            <div class="pill-icon soc-ring ${isBatteryCharging || isBatteryDischarging ? 'bg-battery' : 'bg-inactive'}" style="--soc: ${Math.round(batterySoc)}; --soc-color: ${this._socColor(batterySoc)};">
              <ha-icon icon="${batteryIcon}" class="${isBatteryCharging || isBatteryDischarging ? 'color-battery' : 'color-inactive'}"></ha-icon>
            </div>
            <div class="pill-content">
              <span class="pill-val" style="color: ${this._socColor(batterySoc)};">${Math.round(batterySoc)}%</span>
              <span class="pill-label">${isBatteryCharging ? this._t('charging') : isBatteryDischarging ? this._t('discharging') : this._t('standby')}</span>
            </div>
          </div>
          ` : ''}

          <!-- EV Pill (Bottom Left - Carport) - Clickable for history -->
          ${hasEV ? `
          <div class="pill pill-ev" style="top: ${pillPos.ev.y}%; left: ${pillPos.ev.x}%; --pill-scale: ${pillPos.ev.scale};" data-entity="${this._config.ev_power}">
            <div class="pill-icon ${hasEvSoc ? 'soc-ring' : ''} ${isEvCharging ? 'bg-ev' : 'bg-inactive'}" ${hasEvSoc ? `style="--soc: ${Math.round(evSoc)}; --soc-color: ${this._socColor(evSoc)};"` : ''}>
              ${hasEvSoc
                ? `<span class="pill-icon-soc" style="color: ${this._socColor(evSoc)};">${Math.round(evSoc)}%</span>`
                : `<ha-icon icon="mdi:car-electric" class="${isEvCharging ? 'color-ev' : 'color-inactive'}"></ha-icon>`}
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
          ${this._renderExtraPills()}
          ${this._renderWeatherCycleButton()}
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
  `%c PRISM-ENERGY %c v1.6.1 %c Icon-only weather pill, slower beams, movable header `,
  'background: #F59E0B; color: black; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #1e2024; color: white; font-weight: bold; padding: 2px 6px;',
  'background: #3B82F6; color: white; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

