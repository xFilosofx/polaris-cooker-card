# Polaris Cooker Card

Lovelace-карточка для мультиварки Polaris на интеграции
[ha-syncleo](https://github.com/xFilosofx/ha-syncleo) (Syncleo UDP).

- кастрюля с анимированной водой: пока программа выполняется — кипение пузырьками и пар,
  в покое поверхность спокойная, уровень и оттенок воды зависят от температуры в чаше;
- программы одним тапом, кнопки «Старт»/«Стоп»;
- слайдеры температуры, таймера и отложенного старта;
- переключатели подогрева и замка от детей;
- индикация ошибки устройства.

## Установка

Через Marketplace (HACS) как custom repository категории `plugin`, либо вручную —
положить `polaris-cooker-card.js` в `config/www/` и добавить ресурс:

```yaml
url: /local/polaris-cooker-card.js
type: module
```

## Конфиг

```yaml
type: custom:polaris-cooker-card
name: Мультиварка
entities:
  program: select.pmc_0528wifi_cooking_program
  start: button.pmc_0528wifi_start_program
  stop: button.pmc_0528wifi_stop
  temperature: sensor.pmc_0528wifi_cooker_temperature
  target_temperature: number.pmc_0528wifi_target_temperature
  timer: number.pmc_0528wifi_timer
  delay_start: number.pmc_0528wifi_delay_start
  keep_warm: switch.pmc_0528wifi_keep_warm
  child_lock: switch.pmc_0528wifi_child_lock
  error: binary_sensor.pmc_0528wifi_error
```
