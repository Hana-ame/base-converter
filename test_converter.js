#!/usr/bin/env node
'use strict';

const assert = require('assert');
const C = require('./converter.js');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓ ' + name);
}

console.log('converter.js tests');

check('groupDigits groups from the right', () => {
  assert.strictEqual(C.groupDigits('1'), '1');
  assert.strictEqual(C.groupDigits('1234'), '1234');
  assert.strictEqual(C.groupDigits('12345'), '1_2345');
  assert.strictEqual(C.groupDigits('11111111'), '1111_1111');
  assert.strictEqual(C.groupDigits('4294967295'), '42_9496_7295');
  assert.strictEqual(C.groupDigits('1234567890123456'), '1234_5678_9012_3456');
});

check('parse simple values in every base', () => {
  assert.strictEqual(C.parse('255', 'DEC').value, 255n);
  assert.strictEqual(C.parse('FF', 'HEX').value, 255n);
  assert.strictEqual(C.parse('11111111', 'BIN').value, 255n);
  assert.strictEqual(C.parse('377', 'OCT').value, 255n);
  assert.strictEqual(C.parse('ff', 'HEX').value, 255n);
});

check('parse ignores spaces and underscores', () => {
  assert.strictEqual(C.parse('1111_1111', 'BIN').value, 255n);
  assert.strictEqual(C.parse('FF FF', 'HEX').value, 65535n);
  assert.strictEqual(C.parse('1 0000 0000', 'BIN').value, 256n);
  assert.strictEqual(C.parse('1_2345_6789', 'DEC').value, 123456789n);
});

check('explicit prefixes auto-detect the base', () => {
  const hex = C.parse('0xFF', 'DEC');
  assert.strictEqual(hex.ok, true);
  assert.strictEqual(hex.base, 'HEX');
  assert.strictEqual(hex.hasPrefix, true);
  assert.strictEqual(hex.value, 255n);

  assert.strictEqual(C.parse('0b1010', 'DEC').base, 'BIN');
  assert.strictEqual(C.parse('0b1010', 'DEC').value, 10n);
  assert.strictEqual(C.parse('0o777', 'DEC').base, 'OCT');
  assert.strictEqual(C.parse('0o777', 'DEC').value, 511n);
  assert.strictEqual(C.parse('0Xdead_BEEF', 'DEC').value, 0xdeadbeefn);
});

check('negative and positive signs', () => {
  const neg = C.parse('-0x10', 'DEC');
  assert.strictEqual(neg.value, -16n);
  assert.strictEqual(C.parse('-1010', 'BIN').value, -10n);
  assert.strictEqual(C.parse('+42', 'DEC').value, 42n);
  assert.strictEqual(C.parse('-0', 'DEC').value, 0n);
});

check('empty and incomplete inputs are not errors', () => {
  for (const raw of ['', '   ', '_ _', '+', '-', '0x', '0b_', '0o ']) {
    const p = C.parse(raw, 'HEX');
    assert.strictEqual(p.ok, false, raw);
    assert.strictEqual(p.incomplete, true, raw);
    assert.strictEqual(p.error, null, raw);
  }
  assert.strictEqual(C.parse('', 'DEC').empty, true);
});

check('invalid digits produce readable errors', () => {
  const bin = C.parse('102', 'BIN');
  assert.strictEqual(bin.ok, false);
  assert.match(bin.error, /「2」/);
  assert.match(bin.error, /二进制/);

  const hex = C.parse('FG', 'HEX');
  assert.match(hex.error, /「G」/);
  assert.strictEqual(C.parse('8', 'OCT').ok, false);
  assert.strictEqual(C.parse('1.5', 'DEC').ok, false);
  assert.strictEqual(C.parse('0xGG', 'DEC').ok, false);
});

check('detectBase picks a comfortable default', () => {
  assert.strictEqual(C.detectBase('255', 'DEC'), 'DEC');
  assert.strictEqual(C.detectBase('1010', 'BIN'), 'BIN');
  assert.strictEqual(C.detectBase('777', 'OCT'), 'OCT');
  assert.strictEqual(C.detectBase('FF', 'DEC'), 'HEX');
  assert.strictEqual(C.detectBase('dead_beef', 'DEC'), 'HEX');
  assert.strictEqual(C.detectBase('FF', 'BIN'), 'HEX');
  assert.strictEqual(C.detectBase('-ABCD', 'DEC'), 'HEX');
  assert.strictEqual(C.detectBase('0xFF', 'DEC'), 'HEX');
  assert.strictEqual(C.detectBase('0b1010', 'DEC'), 'BIN');
  assert.strictEqual(C.detectBase('0o777', 'DEC'), 'OCT');
  assert.strictEqual(C.detectBase('G', 'DEC'), 'DEC');
  assert.strictEqual(C.detectBase('777', 'BIN'), 'BIN');
  assert.strictEqual(C.detectBase('', 'DEC'), 'DEC');
});

check('format each base with prefix and grouping', () => {
  assert.strictEqual(C.format(255n, 'HEX'), '0xFF');
  assert.strictEqual(C.format(65535n, 'HEX'), '0xFFFF');
  assert.strictEqual(C.format(4294967295n, 'HEX'), '0xFFFF_FFFF');
  assert.strictEqual(C.format(255n, 'BIN'), '0b1111_1111');
  assert.strictEqual(C.format(511n, 'OCT'), '0o777');
  assert.strictEqual(C.format(4294967295n, 'DEC'), '42_9496_7295');
  assert.strictEqual(C.format(0n, 'HEX'), '0x0');
  assert.strictEqual(C.format(0n, 'BIN'), '0b0');
});

check('format options for grouping / prefix / negatives', () => {
  assert.strictEqual(C.format(65535n, 'HEX', { group: false }), '0xFFFF');
  assert.strictEqual(C.format(65535n, 'HEX', { prefix: false }), 'FFFF');
  assert.strictEqual(C.format(65535n, 'HEX', { prefix: false, group: false }), 'FFFF');
  assert.strictEqual(C.format(-4294967295n, 'HEX'), '-0xFFFF_FFFF');
  assert.strictEqual(C.format(-12345678n, 'DEC'), '-1234_5678');
  assert.strictEqual(C.format(65535, 'HEX'), '0xFFFF');
  assert.strictEqual(C.format('65535', 'HEX'), '0xFFFF');
});

check('bit length', () => {
  assert.strictEqual(C.bitLength(0n), 1);
  assert.strictEqual(C.bitLength(1n), 1);
  assert.strictEqual(C.bitLength(255n), 8);
  assert.strictEqual(C.bitLength(256n), 9);
  assert.strictEqual(C.bitLength(-256n), 9);
  assert.strictEqual(C.bitLength(1n << 128n), 129);
});

check('convert returns all four bases', () => {
  assert.deepStrictEqual(C.convert(255n), {
    HEX: '0xFF',
    BIN: '0b1111_1111',
    OCT: '0o377',
    DEC: '255'
  });
});

check('stripPrefix keeps sign and payload', () => {
  assert.strictEqual(C.stripPrefix('0xFF'), 'FF');
  assert.strictEqual(C.stripPrefix('-0b1010'), '-1010');
  assert.strictEqual(C.stripPrefix('  + 0o777'), '  + 777');
  assert.strictEqual(C.stripPrefix('255'), '255');
});

check('round-trip random BigInts through every base', () => {
  let seed = 20261111n;
  for (let i = 0; i < 200; i += 1) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 256n) - 1n);
    const negative = (seed & 1n) === 1n;
    const value = negative ? -seed : seed;
    for (const base of C.BASE_ORDER) {
      const text = C.format(value, base, { group: true, prefix: true });
      const parsed = C.parse(text, 'DEC');
      assert.strictEqual(parsed.ok, true, base + ' ' + text);
      assert.strictEqual(parsed.value, value, base + ' ' + text);
    }
  }
});

check('large values beyond Number.MAX_SAFE_INTEGER', () => {
  const big = (1n << 200n) + 12345n;
  const hex = C.format(big, 'HEX');
  assert.strictEqual(hex.startsWith('0x'), true);
  assert.strictEqual(C.parse(hex, 'DEC').value, big);
  assert.strictEqual(C.parse(C.format(big, 'DEC'), 'DEC').value, big);
});

check('keysFor returns the pad keys for each base', () => {
  assert.deepStrictEqual(C.keysFor('DEC'), ['0','1','2','3','4','5','6','7','8','9']);
  assert.deepStrictEqual(C.keysFor('BIN'), ['0','1']);
  assert.deepStrictEqual(C.keysFor('OCT'), ['0','1','2','3','4','5','6','7']);
  assert.strictEqual(C.keysFor('HEX').length, 16);
  assert.strictEqual(C.keysFor('HEX').includes('F'), true);
  assert.deepStrictEqual(C.keysFor('BOGUS'), C.keysFor('DEC'));
  assert.deepStrictEqual(C.keysFor('HEX'), C.keysFor('HEX'));
  assert.strictEqual(C.keysFor('HEX') === C.keysFor('HEX'), false, 'returns a fresh array');
});

check('columnsFor returns a fixed grid column count per base', () => {
  assert.strictEqual(C.columnsFor('DEC'), 5);
  assert.strictEqual(C.columnsFor('HEX'), 6);
  assert.strictEqual(C.columnsFor('BIN'), 2);
  assert.strictEqual(C.columnsFor('OCT'), 4);
  assert.strictEqual(C.columnsFor('BOGUS'), 5);
});

console.log('\nAll ' + passed + ' test groups passed.');
