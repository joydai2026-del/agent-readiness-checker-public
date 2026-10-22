import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, isAllowed } from '../src/robots.js';
import { readFixture } from './helpers/fake-store.js';

test('star group applies when a bot has no group of its own', () => {
  const r = parseRobots('User-agent: *\nDisallow: /admin\n');
  assert.equal(isAllowed(r, 'OAI-SearchBot', '/'), true);
  assert.equal(isAllowed(r, 'OAI-SearchBot', '/admin/x'), false);
});

test('stacked user-agent lines share one group; bot names are case-insensitive', () => {
  const r = parseRobots(readFixture('shopify-bad', 'robots.txt'));
  assert.equal(isAllowed(r, 'oai-searchbot', '/'), false);
  assert.equal(isAllowed(r, 'PerplexityBot', '/products/x'), false);
  assert.equal(isAllowed(r, 'Claude-SearchBot', '/'), true);
  assert.equal(isAllowed(r, 'Claude-SearchBot', '/products/x'), false);
  assert.equal(isAllowed(r, 'Googlebot', '/products/x'), true);
});

test('longest rule wins and Allow wins a tie', () => {
  const r = parseRobots('User-agent: *\nDisallow: /shop\nAllow: /shop/products\nDisallow: /x\nAllow: /x\n');
  assert.equal(isAllowed(r, 'a', '/shop/cart'), false);
  assert.equal(isAllowed(r, 'a', '/shop/products/mug'), true);
  assert.equal(isAllowed(r, 'a', '/x'), true);
});

test('wildcards and end anchors', () => {
  const r = parseRobots('User-agent: *\nDisallow: /*.json$\nDisallow: /*?q=\n');
  assert.equal(isAllowed(r, 'a', '/products.json'), false);
  assert.equal(isAllowed(r, 'a', '/products.json?x=1'), true);
  assert.equal(isAllowed(r, 'a', '/search?q=mug'), false);
});

test('empty Disallow allows everything; comments and Sitemap lines are read', () => {
  const r = parseRobots('# hi\nUser-agent: GPTBot\nDisallow:\nSitemap: https://a.example/s.xml\n');
  assert.equal(isAllowed(r, 'GPTBot', '/'), true);
  assert.deepEqual(r.sitemaps, ['https://a.example/s.xml']);
});

test('no robots file means everything is allowed', () => {
  assert.equal(isAllowed(parseRobots(''), 'OAI-SearchBot', '/products/x'), true);
});

test('a hostile wildcard rule cannot freeze the server', () => {
  const evil = '/' + 'a*'.repeat(25) + 'b';
  const r = parseRobots(`User-agent: *\nDisallow: ${evil}\n`);
  const t = Date.now();
  assert.equal(isAllowed(r, 'x', '/' + 'a'.repeat(60)), true);
  assert.equal(isAllowed(r, 'x', '/' + 'a'.repeat(5000)), true);
  assert.ok(Date.now() - t < 500, `took ${Date.now() - t}ms`);
});

test('round 4: a huge file of hostile rules stays fast', () => {
  const evil = `User-agent: *\n${`Disallow: /*${'a'.repeat(500)}b$\n`.repeat(970)}`;
  const r = parseRobots(evil);
  const path = `/products/${'a'.repeat(1980)}`;
  const t = Date.now();
  for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Claude-User', 'Googlebot', 'GPTBot', 'ClaudeBot', 'Google-Extended']) {
    isAllowed(r, bot, path);
    isAllowed(r, bot, '/');
  }
  assert.ok(Date.now() - t < 1000, `took ${Date.now() - t}ms`);
});

test('wildcard edge cases match the RFC 9309 examples', () => {
  const r = (rule) => parseRobots(`User-agent: *\nDisallow: ${rule}\n`);
  assert.equal(isAllowed(r('/fish*.php'), 'x', '/fish.php'), false);
  assert.equal(isAllowed(r('/fish*.php'), 'x', '/fishheads/catfish.php?parameters'), false);
  assert.equal(isAllowed(r('/fish*.php'), 'x', '/Fish.PHP'), true);
  assert.equal(isAllowed(r('/*.php$'), 'x', '/folder/filename.php'), false);
  assert.equal(isAllowed(r('/*.php$'), 'x', '/filename.php?parameters'), true);
  assert.equal(isAllowed(r('/fish$'), 'x', '/fish'), false);
  assert.equal(isAllowed(r('/fish$'), 'x', '/fishy'), true);
  assert.equal(isAllowed(r('/a*b*c'), 'x', '/aXbYc'), false);
  assert.equal(isAllowed(r('/a*b*c'), 'x', '/aXcYb'), true);
});
