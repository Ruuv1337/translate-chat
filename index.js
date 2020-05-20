const VAILABLE_LANGUAGES = ['af', 'sq', 'ar', 'az', 'eu', 'bn', 'be', 'bg', 'ca', 'zh-CN', 'zh-TW', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'tl', 'fi', 'fr', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'iw', 'hi', 'hu', 'is', 'id', 'ga', 'it', 'ja', 'kn', 'ko', 'la', 'lv', 'lt', 'mk', 'ms', 'mt', 'no', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi', 'cy', 'yi', 'auto'];
const translate = require('google-translate-api');
const { normalize } = require('./normalize');
const latinize = (str) => {
  return normalize(str)
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+$/, '');
};

module.exports = class Translator {
  constructor(mod) {
    this.mod = mod;
    this.addCommand();
    this.setupHooks();

    this.mod.game.on('leave_loading_screen', () => {
      if (mod.settings.sendMode) {
        this.mod.command.message('Send Mode Enabled. Translating outgoing messages to '+this.mod.settings.sendLang);
        this.mod.command.message('Use "/8 tr send off" to disable it.');
      }
    });
  }

  setupHooks() {
    const incomingMsgHandler = async (packet, version, event) => {
      if (!this.mod.settings.enabled) return;
      if (this.mod.game.me.is(event.gameId)) return;

      const translated = await this.translate(event.message, this.mod.settings.fromLang, this.mod.settings.toLang );
      if (!translated) return;

      this.mod.send(packet, version, { ...event, message: translated.text, name: event.name + ' (Translated)' });
    };

    const outgoingMessageHandler = (packet, version, event) => {
      if (packet === 'C_WHISPER') {
        event.target = event.target.replace(/(\(Translated\)).*?/g, '').replace(/\s+$/, '');
      }
      if (!this.mod.settings.sendMode) return true;

      (async () => {
        const translated = await this.translate(event.message, 'auto', this.mod.settings.sendLang );
        if (!translated) return this.mod.send(packet, version, event);

        this.mod.send(packet, version, { ...event, message: '<FONT>'+translated.text+'</FONT>' });
        this.mod.command.message(`Original message: ${event.message.replace(/<(.+?)>|&rt;|&lt;|&gt;|/g, '').replace(/\s+$/, '')}`);
      })();

      return false;
    };

    const CHAT_SERVER_PACKETS = [['S_CHAT', 3], ['S_WHISPER', 3], ['S_PRIVATE_CHAT', 1]];
    const CHAT_CLIENT_PACKETS = [['C_WHISPER', 1], ['C_CHAT', 1]];
    for (const [packet, version] of CHAT_SERVER_PACKETS) this.mod.hook(packet, version, { order: 100 }, event => incomingMsgHandler(packet, version, event));
    for (const [packet, version] of CHAT_CLIENT_PACKETS) this.mod.hook(packet, version, {}, event => outgoingMessageHandler(packet, version, event));
  }

  async translate(message, source, target) {
    const sanitized = message.replace(/<(.+?)>|&rt;|&lt;|&gt;|/g, '').replace(/\s+$/, '');
    if (sanitized === '') return;

    const translated = await translate(sanitized, { from: source, to: target } )
      .catch(e => {
        this.mod.error(
          'Error occurred during translation message:'+message,
          'from:'+target,
          'to:'+source,
          'error:', e);
        return '';
      });
  
    if (translated === sanitized) return;
    if (this.mod.settings.latinize) return latinize(translated);
    return translated;
  }

  addCommand() {
    this.mod.command.add('tr', {
      $default: () => {
        this.mod.settings.enabled = !this.mod.settings.enabled;
        this.mod.command.message('<font color="#00ffff">[TRANSLATER (from & to)] </font><font color="#ffff00">' + (this.mod.settings.enabled ? 'Enabled' : 'Disabled') + '.</font>')
        this.mod.saveSettings();
      },
      from: language => {
        if (!language) {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER from]</font> Language: '+this.mod.settings.fromLang);
          return;
        }
        if (!AVAILABLE_LANGUAGES.includes(language)) {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER from]</font> Error: '+language+' is not a valid language. See readme for available languages. Recommended Setting: auto');
          return;
        }
        this.mod.command.message('<font color="#00ffff">[TRANSLATER from]</font> Language set to: '+language);
        this.mod.settings.fromLang = language;
        this.mod.saveSettings();
      },
      to: language => {
        if (!language) {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER to]</font> Language: '+this.mod.settings.toLang);
          return;
        }
        if (!AVAILABLE_LANGUAGES.includes(language)) {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER to]</font> Error: '+language+' is not a valid language. See readme for available languages.');
          return;
        }
        if (language === 'auto') {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER to]</font> Error: To Language cannot be auto.');
          return;
        }

        this.mod.command.message('<font color="#00ffff">[TRANSLATER to]</font> Language set to: '+language);
        this.mod.settings.toLang = language;
        this.mod.saveSettings();
      },
      send: enable => {
        if (enable === undefined) {
          this.mod.settings.sendMode = !this.mod.settings.sendMode;
          this.mod.command.message('<font color="#00ffff">[TRANSLATER]</font> Send Mode: ' + ( this.mod.settings.sendMode ? ('enabled. Language: ' + this.mod.settings.sendLang) : 'disabled.'));
        } else if (AVAILABLE_LANGUAGES.includes(enable)) {
          this.mod.settings.sendMode = true;
          this.mod.settings.sendLang = enable;
          this.mod.command.message('<font color="#00ffff">[TRANSLATER]</font> Now translating outgoing messages to: '+enable);
        } else if (enable === 'off') {
          this.mod.settings.sendMode = false;
          this.mod.command.message('<font color="#00ffff">[TRANSLATER]</font> Send Mode Disabled.');
        } else if (enable === 'on') {
          this.mod.settings.sendMode = true;
          this.mod.command.message('<font color="#00ffff">[TRANSLATER]</font> Send Mode Enabled. Now translating outgoing messages to '+this.mod.settings.sendLang);
        } else {
          this.mod.command.message('<font color="#00ffff">[TRANSLATER]</font> Error: '+enable+' is not a valid language. See readme for available languages.');
        }
        this.mod.saveSettings();
      }
    });
  }
};
