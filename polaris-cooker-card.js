/**
 * polaris-cooker-card — панель управления мультиваркой Polaris (интеграция syncleo).
 *
 * Карточка рисует кастрюлю с анимированной водой: пока программа выполняется,
 * вода кипит пузырьками и поднимается пар, в покое поверхность спокойная.
 * Внизу — управление: программы, старт/стоп, температура, таймер, отложенный старт,
 * подогрев и замок от детей.
 *
 * Конфиг:
 *   type: custom:polaris-cooker-card
 *   name: Мультиварка
 *   entities:
 *     program: select.pmc_0528wifi_cooking_program
 *     start: button.pmc_0528wifi_start_program
 *     stop: button.pmc_0528wifi_stop
 *     temperature: sensor.pmc_0528wifi_cooker_temperature
 *     target_temperature: number.pmc_0528wifi_target_temperature
 *     timer: number.pmc_0528wifi_timer
 *     delay_start: number.pmc_0528wifi_delay_start
 *     keep_warm: switch.pmc_0528wifi_keep_warm
 *     child_lock: switch.pmc_0528wifi_child_lock
 *     error: binary_sensor.pmc_0528wifi_error
 */

const BUBBLES = 14;

class PolarisCookerCard extends HTMLElement {
  static getStubConfig(hass) {
    const states = hass ? hass.states : {};
    const program = Object.keys(states).find((e) => e.startsWith("select.") && e.includes("cooking_program"));
    const prefix = program ? program.split("_cooking_program")[0] : "select.pmc_0528wifi";
    const base = program ? program.replace(/_cooking_program$/, "") : "pmc_0528wifi";
    return {
      name: "Мультиварка",
      entities: {
        program: program || "select.pmc_0528wifi_cooking_program",
        start: `button.${base}_start_program`,
        stop: `button.${base}_stop`,
        temperature: `sensor.${base}_cooker_temperature`,
        target_temperature: `number.${base}_target_temperature`,
        timer: `number.${base}_timer`,
        delay_start: `number.${base}_delay_start`,
        keep_warm: `switch.${base}_keep_warm`,
        child_lock: `switch.${base}_child_lock`,
        error: `binary_sensor.${base}_error`,
      },
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = undefined;
    this._bubbles = Array.from({ length: BUBBLES }, (_, i) => ({
      left: 6 + Math.random() * 88,
      size: 4 + Math.random() * 9,
      delay: Math.random() * 4,
      duration: 1.6 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * 18,
      key: i,
    }));
  }

  setConfig(config) {
    if (!config || !config.entities || !config.entities.program) {
      throw new Error("polaris-cooker-card: укажи entities.program и остальные сущности");
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 8;
  }

  // ---- helpers ---------------------------------------------------------

  _state(key) {
    const id = this._config?.entities?.[key];
    return id ? this._hass?.states?.[id] : undefined;
  }

  _value(key, fallback = "—") {
    const s = this._state(key);
    if (!s || s.state === "unknown" || s.state === "unavailable") return fallback;
    return s.state;
  }

  _num(key, fallback = 0) {
    const v = parseFloat(this._value(key, ""));
    return Number.isFinite(v) ? v : fallback;
  }

  _isOn(key) {
    return this._value(key, "off") === "on";
  }

  _error() {
    const s = this._state("error");
    if (!s) return { active: false, text: "" };
    const active = s.state === "on";
    return { active, text: active ? s.attributes?.friendly_name || "ошибка" : "" };
  }

  _cooking() {
    const program = this._value("program", "");
    const timer = this._num("timer", 0);
    const target = this._num("target_temperature", 0);
    const temp = this._num("temperature", 0);
    return (program !== "" && program !== "unknown") || timer > 0 || (target > 0 && temp > 0 && timer > 0);
  }

  _call(domain, service, data) {
    if (!this._hass) return;
    this._hass.callService(domain, service, data);
  }

  _selectProgram(option) {
    this._call("select", "select_option", {
      entity_id: this._config.entities.program,
      option,
    });
  }

  _start() {
    this._call("button", "press", { entity_id: this._config.entities.start });
  }

  _stop() {
    this._call("button", "press", { entity_id: this._config.entities.stop });
  }

  _setNumber(key, value) {
    const id = this._config.entities[key];
    if (!id) return;
    this._call("number", "set_value", { entity_id: id, value: Number(value) });
  }

  _toggle(key) {
    const id = this._config.entities[key];
    if (!id) return;
    const on = this._isOn(key);
    this._call("switch", on ? "turn_off" : "turn_on", { entity_id: id });
  }

  // ---- render ----------------------------------------------------------

  _render() {
    if (!this._config || !this._hass) return;

    const name = this._config.name || "Мультиварка";
    const program = this._value("program", "");
    const running = program !== "" && program !== "unknown";
    const cooking = this._cooking();
    const temp = this._num("temperature", 0);
    const target = this._num("target_temperature", 0);
    const timer = this._num("timer", 0);
    const delay = this._num("delay_start", 0);
    const keepWarm = this._isOn("keep_warm");
    const childLock = this._isOn("child_lock");
    const err = this._error();

    const programState = this._state("program");
    const options = programState?.attributes?.options || [];

    const tempNumber = this._state("target_temperature");
    const tempMin = tempNumber?.attributes?.min ?? 30;
    const tempMax = tempNumber?.attributes?.max ?? 160;
    const tempStep = tempNumber?.attributes?.step ?? 5;

    const timerNumber = this._state("timer");
    const timerMax = timerNumber?.attributes?.max ?? 720;

    const delayNumber = this._state("delay_start");
    const delayMax = delayNumber?.attributes?.max ?? 1440;

    const statusText = err.active
      ? "Ошибка"
      : running
        ? `Готовит · ${program}`
        : keepWarm && temp > 45
          ? "Подогрев"
          : "Ожидание";

    const waterTemp = Math.max(0, Math.min(1, temp / 120));

    this.shadowRoot.innerHTML = `
      <ha-card>
        <style>
          :host { display: block; }
          ha-card {
            padding: 16px;
            background: var(--ha-card-background, var(--card-background-color));
            color: var(--primary-text-color);
            box-sizing: border-box;
          }
          .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
          .title { font-size: 1.15rem; font-weight: 600; }
          .status {
            font-size: .8rem; font-weight: 600; padding: 3px 10px; border-radius: 999px;
            background: var(--secondary-background-color); color: var(--secondary-text-color);
            white-space: nowrap;
          }
          .status.cooking { background: rgba(255,152,0,.18); color: #ff9800; }
          .status.error { background: rgba(244,67,54,.18); color: #f44336; }
          .status.warm { background: rgba(255,87,34,.16); color: #ff5722; }

          .stage { position: relative; margin: 14px auto 6px; width: 100%; max-width: 340px; }
          .pot { position: relative; width: 100%; aspect-ratio: 1 / .78; }
          .lid {
            position: absolute; left: 8%; right: 8%; top: 0; height: 13%;
            background: linear-gradient(180deg, #d7dde7, #9aa5b5);
            border-radius: 50% / 100% 100% 0 0;
            box-shadow: inset 0 -3px 6px rgba(0,0,0,.18);
          }
          .knob {
            position: absolute; left: 50%; top: -5%; width: 12%; height: 8%;
            transform: translateX(-50%);
            background: linear-gradient(180deg, #aab4c2, #6f7b8c);
            border-radius: 999px;
          }
          .body {
            position: absolute; left: 2%; right: 2%; top: 10%; bottom: 0;
            border-radius: 28% 28% 22% 22% / 14% 14% 20% 20%;
            background: linear-gradient(160deg, #f4f6f9 0%, #c9d2de 40%, #98a4b5 100%);
            box-shadow: inset 0 8px 22px rgba(255,255,255,.7), inset 0 -16px 28px rgba(0,0,0,.22),
                        0 10px 22px rgba(0,0,0,.22);
            overflow: hidden;
          }
          .water {
            position: absolute; left: 0; right: 0; bottom: 0;
            height: calc(18% + var(--level) * 52%);
            background: linear-gradient(180deg, rgba(120,200,255,.85), rgba(30,120,200,.92));
            transition: height .8s ease;
          }
          .water::before {
            content: ""; position: absolute; left: -50%; right: -50%; top: -12px; height: 24px;
            background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.55), transparent 60%);
            opacity: .5;
          }
          .pot.cooking .water { animation: surge 2.4s ease-in-out infinite; }
          @keyframes surge {
            0%, 100% { transform: translateY(0) scaleY(1); }
            50% { transform: translateY(-4px) scaleY(1.03); }
          }
          .bubble {
            position: absolute; bottom: 4%;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #ffffff, rgba(255,255,255,.25) 70%);
            opacity: 0;
            pointer-events: none;
          }
          .cooking .bubble { animation-name: rise; animation-timing-function: ease-in; animation-iteration-count: infinite; }
          @keyframes rise {
            0%   { transform: translate(0, 0) scale(.6); opacity: 0; }
            12%  { opacity: .85; }
            70%  { opacity: .75; }
            100% { transform: translate(var(--drift), -120px) scale(1.15); opacity: 0; }
          }
          .steam {
            position: absolute; left: 50%; top: 2%; width: 60%; height: 40%;
            transform: translateX(-50%);
            display: flex; justify-content: space-around; opacity: 0; transition: opacity .6s;
            pointer-events: none;
          }
          .cooking .steam { opacity: .55; }
          .steam i {
            display: block; width: 10px; height: 100%; border-radius: 999px;
            background: linear-gradient(180deg, rgba(255,255,255,.9), transparent);
            filter: blur(3px); animation: steam 3s ease-in-out infinite;
          }
          .steam i:nth-child(2) { animation-delay: .8s; }
          .steam i:nth-child(3) { animation-delay: 1.6s; }
          @keyframes steam {
            0% { transform: translateY(10px) scaleY(.7); opacity: 0; }
            40% { opacity: .8; }
            100% { transform: translateY(-22px) scaleY(1.2); opacity: 0; }
          }
          .readout {
            position: absolute; left: 0; right: 0; top: 34%; text-align: center;
            color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.45); pointer-events: none;
          }
          .readout .big { font-size: 2.1rem; font-weight: 700; line-height: 1; }
          .readout .sub { font-size: .78rem; opacity: .9; margin-top: 4px; }
          .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
          .chip {
            font-size: .78rem; padding: 5px 10px; border-radius: 999px; cursor: pointer;
            border: 1px solid var(--divider-color); color: var(--primary-text-color);
            background: var(--secondary-background-color); transition: all .15s;
            user-select: none;
          }
          .chip:hover { border-color: var(--primary-color); }
          .chip.active {
            background: var(--primary-color); color: var(--text-primary-color, #fff);
            border-color: var(--primary-color); font-weight: 600;
          }
          .actions { display: flex; gap: 8px; margin-top: 10px; }
          button {
            flex: 1; font: inherit; font-weight: 600; cursor: pointer; border-radius: 12px;
            padding: 11px 8px; border: none; transition: transform .08s, filter .15s;
          }
          button:active { transform: scale(.98); }
          .start { background: var(--primary-color); color: var(--text-primary-color, #fff); }
          .start[disabled] { opacity: .45; cursor: not-allowed; }
          .stop { background: rgba(244,67,54,.14); color: #f44336; }
          .rows { display: grid; gap: 8px; margin-top: 12px; }
          .row { display: grid; grid-template-columns: 92px 1fr auto; align-items: center; gap: 10px; }
          .row label { font-size: .82rem; color: var(--secondary-text-color); }
          .row .val { font-size: .85rem; font-variant-numeric: tabular-nums; min-width: 62px; text-align: right; }
          input[type="range"] { width: 100%; accent-color: var(--primary-color); }
          .toggles { display: flex; gap: 8px; margin-top: 12px; }
          .toggle {
            flex: 1; display: flex; align-items: center; justify-content: space-between;
            gap: 8px; padding: 9px 12px; border-radius: 12px; cursor: pointer;
            background: var(--secondary-background-color); font-size: .84rem;
          }
          .toggle span.dot {
            width: 34px; height: 18px; border-radius: 999px; position: relative;
            background: var(--divider-color); transition: background .2s; flex: none;
          }
          .toggle span.dot::after {
            content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
            border-radius: 50%; background: #fff; transition: transform .2s;
          }
          .toggle.on span.dot { background: var(--primary-color); }
          .toggle.on span.dot::after { transform: translateX(16px); }
          .err {
            margin-top: 10px; padding: 8px 10px; border-radius: 10px; font-size: .82rem;
            background: rgba(244,67,54,.12); color: #f44336;
          }
          .unavailable { opacity: .5; }
        </style>

        <div class="head">
          <div class="title">${name}</div>
          <div class="status ${err.active ? "error" : cooking ? "cooking" : keepWarm && temp > 45 ? "warm" : ""}">${statusText}</div>
        </div>

        <div class="stage">
          <div class="pot ${cooking ? "cooking" : ""}">
            <div class="steam"><i></i><i></i><i></i></div>
            <div class="lid"></div>
            <div class="knob"></div>
            <div class="body">
              <div class="water" style="--level:${waterTemp.toFixed(2)}"></div>
              ${this._bubbles
                .map(
                  (b) => `<span class="bubble" style="
                    left:${b.left.toFixed(1)}%;
                    width:${b.size.toFixed(1)}px; height:${b.size.toFixed(1)}px;
                    animation-duration:${b.duration.toFixed(2)}s;
                    animation-delay:${b.delay.toFixed(2)}s;
                    --drift:${b.drift.toFixed(1)}px;"></span>`
                )
                .join("")}
            </div>
            <div class="readout">
              <div class="big">${temp ? temp.toFixed(0) + "°" : "—"}</div>
              <div class="sub">${running ? `${program}${timer ? " · " + timer.toFixed(0) + " мин" : ""}` : `на доке${keepWarm ? " · подогрев" : ""}`}</div>
            </div>
          </div>
        </div>

        <div class="chips">
          ${options
            .map(
              (o) =>
                `<div class="chip ${o === program ? "active" : ""}" data-program="${this._escape(o)}">${o}</div>`
            )
            .join("")}
        </div>

        <div class="actions">
          <button class="start" ${program && program !== "unknown" ? "" : "disabled"}>Старт программы</button>
          <button class="stop" ${running ? "" : "disabled"}>Стоп</button>
        </div>

        <div class="rows">
          <div class="row">
            <label>Температура</label>
            <input type="range" data-number="target_temperature" min="${tempMin}" max="${tempMax}" step="${tempStep}" value="${target}" />
            <div class="val" data-value="target_temperature">${target.toFixed(0)} °C</div>
          </div>
          <div class="row">
            <label>Таймер</label>
            <input type="range" data-number="timer" min="0" max="${timerMax}" step="5" value="${timer}" />
            <div class="val" data-value="timer">${timer.toFixed(0)} мин</div>
          </div>
          <div class="row">
            <label>Отложенный старт</label>
            <input type="range" data-number="delay_start" min="0" max="${Math.min(delayMax, 720)}" step="10" value="${delay}" />
            <div class="val" data-value="delay_start">${delay.toFixed(0)} мин</div>
          </div>
        </div>

        <div class="toggles">
          <div class="toggle ${keepWarm ? "on" : ""}" data-toggle="keep_warm">
            Подогрев <span class="dot"></span>
          </div>
          <div class="toggle ${childLock ? "on" : ""}" data-toggle="child_lock">
            Замок <span class="dot"></span>
          </div>
        </div>

        ${err.active ? `<div class="err">Ошибка устройства: ${err.text}</div>` : ""}
      </ha-card>
    `;

    this._bind();
  }

  _escape(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  _bind() {
    const root = this.shadowRoot;

    root.querySelectorAll("[data-program]").forEach((el) => {
      el.addEventListener("click", () => this._selectProgram(el.dataset.program));
    });

    root.querySelector(".start")?.addEventListener("click", () => this._start());
    root.querySelector(".stop")?.addEventListener("click", () => this._stop());

    root.querySelectorAll("[data-toggle]").forEach((el) => {
      el.addEventListener("click", () => this._toggle(el.dataset.toggle));
    });

    root.querySelectorAll("input[data-number]").forEach((el) => {
      const key = el.dataset.number;
      const out = root.querySelector(`[data-value="${key}"]`);
      el.addEventListener("input", () => {
        if (out) {
          const suffix = key === "target_temperature" ? " °C" : " мин";
          out.textContent = `${Number(el.value).toFixed(0)}${suffix}`;
        }
      });
      el.addEventListener("change", () => this._setNumber(key, el.value));
    });
  }
}

customElements.define("polaris-cooker-card", PolarisCookerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "polaris-cooker-card",
  name: "Polaris Cooker",
  description: "Мультиварка Polaris: анимация кипения и полное управление",
  preview: true,
});

console.info("%c POLARIS-COOKER-CARD %c 1.0.0 ", "background:#0b7a3b;color:#fff;border-radius:4px 0 0 4px", "background:#333;color:#fff;border-radius:0 4px 4px 0");
