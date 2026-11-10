/*
 * Base Converter core
 * HEX / BIN / OCT / DEC parsing, formatting and 4-digit grouping.
 *
 * Works in the browser (window.BaseConverter) and in Node.js (module.exports).
 * Integer-only, arbitrary precision via BigInt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BaseConverter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BASE_ORDER = ['HEX', 'BIN', 'OCT', 'DEC'];

  var BASES = {
    HEX: {
      name: 'HEX',
      label: '十六进制',
      short: '16',
      radix: 16,
      prefix: '0x',
      allowed: '0-9 A-F',
      pattern: /^[0-9a-fA-F]+$/,
      charPattern: /^[0-9a-fA-F]$/,
      keys: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
      columns: 6
    },
    BIN: {
      name: 'BIN',
      label: '二进制',
      short: '2',
      radix: 2,
      prefix: '0b',
      allowed: '0 1',
      pattern: /^[01]+$/,
      charPattern: /^[01]$/,
      keys: ['0', '1'],
      columns: 4
    },
    OCT: {
      name: 'OCT',
      label: '八进制',
      short: '8',
      radix: 8,
      prefix: '0o',
      allowed: '0-7',
      pattern: /^[0-7]+$/,
      charPattern: /^[0-7]$/,
      keys: ['0', '1', '2', '3', '4', '5', '6', '7'],
      columns: 5
    },
    DEC: {
      name: 'DEC',
      label: '十进制',
      short: '10',
      radix: 10,
      prefix: '',
      allowed: '0-9',
      pattern: /^[0-9]+$/,
      charPattern: /^[0-9]$/,
      keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      columns: 3
    }
  };

  var PREFIX_TO_BASE = { '0x': 'HEX', '0b': 'BIN', '0o': 'OCT' };

  /** Remove spaces and underscores (accepted as visual separators). */
  function clean(input) {
    return String(input == null ? '' : input).replace(/[\s_]/g, '');
  }

  /**
   * Group digits with an underscore every 4 characters, counting from the
   * least-significant (right-hand) side: 11111111 -> 1111_1111,
   * 4294967295 -> 42_4967_7295.
   */
  function groupDigits(digits) {
    if (typeof digits !== 'string') digits = String(digits);
    var out = '';
    for (var i = 0; i < digits.length; i += 1) {
      if (i > 0 && (digits.length - i) % 4 === 0) out += '_';
      out += digits.charAt(i);
    }
    return out;
  }

  /** Return the numeric base indicated by an explicit 0x / 0b / 0o prefix. */
  function prefixBaseOf(input) {
    var text = clean(input);
    if (text.charAt(0) === '+' || text.charAt(0) === '-') text = text.slice(1);
    if (text.length < 2 || text.charAt(0) !== '0') return null;
    var marker = '0' + text.charAt(1).toLowerCase();
    return PREFIX_TO_BASE[marker] || null;
  }

  /** Remove a leading base prefix while keeping an optional sign. */
  function stripPrefix(input) {
    return String(input == null ? '' : input).replace(
      /^(\s*[+-]?\s*)0[xXbBoO]\s*/,
      '$1'
    );
  }

  /**
   * Parse a raw input string.
   *
   * @param {string} input       Raw text; spaces, `_`, optional sign and
   *                             optional 0x/0b/0o prefix are accepted.
   * @param {string} selectedBase One of HEX / BIN / OCT / DEC. Used when the
   *                             input has no explicit prefix; an explicit
   *                             prefix overrides it and is auto-detected.
   * @returns {{ok:boolean, empty:boolean, incomplete:boolean, value:?bigint,
   *            base:string, hasPrefix:boolean, digits:string, error:?string}}
   */
  function parse(input, selectedBase) {
    var selected = BASES[selectedBase] ? selectedBase : 'DEC';
    var text = clean(input);
    var base = selected;
    var hasPrefix = false;
    var result = {
      ok: false,
      empty: !text,
      incomplete: false,
      value: null,
      base: base,
      hasPrefix: false,
      digits: '',
      error: null
    };

    if (!text) {
      result.incomplete = true;
      return result;
    }

    var sign = '';
    var body = text;
    if (body.charAt(0) === '+' || body.charAt(0) === '-') {
      sign = body.charAt(0);
      body = body.slice(1);
    }

    if (!body) {
      result.incomplete = true;
      return result;
    }

    if (body.length >= 2 && body.charAt(0) === '0') {
      var marker = '0' + body.charAt(1).toLowerCase();
      if (PREFIX_TO_BASE[marker]) {
        hasPrefix = true;
        base = PREFIX_TO_BASE[marker];
        body = body.slice(2);
        result.base = base;
        result.hasPrefix = true;
        if (!body) {
          result.incomplete = true;
          return result;
        }
      }
    }

    var def = BASES[base];
    result.digits = body;

    if (!def.pattern.test(body)) {
      var bad = '';
      for (var i = 0; i < body.length; i += 1) {
        if (!def.charPattern.test(body.charAt(i))) {
          bad = body.charAt(i);
          break;
        }
      }
      result.error = bad
        ? '「' + bad + '」不是合法的' + def.label + '数字（可用：' + def.allowed + '）'
        : '不是合法的' + def.label + '数字（可用：' + def.allowed + '）';
      return result;
    }

    var abs;
    try {
      abs = BigInt((base === 'DEC' ? '' : def.prefix) + body);
    } catch (err) {
      result.error = '数值无法解析';
      return result;
    }

    result.ok = true;
    result.value = sign === '-' ? -abs : abs;
    return result;
  }

  /**
   * Pick the most likely base for what the user is typing.
   *
   * Explicit 0x / 0b / 0o prefixes always win. Otherwise the selected base is
   * kept when it can parse the digits; if it cannot and the input contains
   * hex letters (A-F), HEX is chosen so pasting `DEADBEEF` just works.
   *
   * @param {string} input
   * @param {string} selectedBase
   * @returns {string} HEX / BIN / OCT / DEC
   */
  function detectBase(input, selectedBase) {
    var selected = BASES[selectedBase] ? selectedBase : 'DEC';
    var text = clean(input);
    if (!text) return selected;

    var prefixed = prefixBaseOf(text);
    if (prefixed) return prefixed;

    var body = text;
    if (body.charAt(0) === '+' || body.charAt(0) === '-') body = body.slice(1);
    if (!body) return selected;

    if (BASES[selected].pattern.test(body)) return selected;
    if (BASES.HEX.pattern.test(body) && /[a-f]/i.test(body)) return 'HEX';
    return selected;
  }

  /**
   * Format a BigInt (or integer-valued string/number) in a given base.
   *
   * @param {bigint|string|number} value
   * @param {string} base
   * @param {{group?:boolean, prefix?:boolean}} [options]
   */
  function format(value, base, options) {
    var def = BASES[base];
    if (!def) throw new Error('Unknown base: ' + base);
    var opts = options || {};
    var group = opts.group !== false;
    var withPrefix = opts.prefix !== false;

    var big;
    if (typeof value === 'bigint') {
      big = value;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error('Only integers can be formatted');
      }
      big = BigInt(value);
    } else {
      big = BigInt(String(value).trim());
    }

    var negative = big < 0n;
    var abs = negative ? -big : big;
    var digits = abs.toString(def.radix);
    if (base === 'HEX') digits = digits.toUpperCase();
    if (group) digits = groupDigits(digits);

    var prefix = withPrefix ? def.prefix : '';
    return (negative ? '-' : '') + prefix + digits;
  }

  /** Number of bits needed for the absolute value (0 counts as 1 bit). */
  function bitLength(value) {
    var big = typeof value === 'bigint' ? value : BigInt(value);
    var abs = big < 0n ? -big : big;
    return abs === 0n ? 1 : abs.toString(2).length;
  }

  /** Convenience: all four representations for one value. */
  function convert(value, options) {
    var out = {};
    for (var i = 0; i < BASE_ORDER.length; i += 1) {
      out[BASE_ORDER[i]] = format(value, BASE_ORDER[i], options);
    }
    return out;
  }

  /** Pad keys for a base (digits plus A-F for HEX). */
  function keysFor(base) {
    var def = BASES[base] ? BASES[base] : BASES.DEC;
    return def.keys.slice();
  }

  /** Number of pad columns for a base (fixed grid, like a keypad). */
  function columnsFor(base) {
    var def = BASES[base] ? BASES[base] : BASES.DEC;
    return def.columns || 5;
  }

  return {
    BASE_ORDER: BASE_ORDER,
    BASES: BASES,
    clean: clean,
    groupDigits: groupDigits,
    prefixBaseOf: prefixBaseOf,
    stripPrefix: stripPrefix,
    parse: parse,
    detectBase: detectBase,
    format: format,
    bitLength: bitLength,
    convert: convert,
    keysFor: keysFor,
    columnsFor: columnsFor
  };
});
