const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  const file = req.url.replace(/^\/tracker\//, '') || 'index.html';
  if (!['index.html','app.js','tracker.js','styles.css'].includes(file)) {res.writeHead(404).end(); return;}
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(await readFile(`${root}/${file}`));
});
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:320,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4174/tracker/');
 async function add(name,gold=0,quests=0){await page.locator('#add-account').click();await page.locator('#account-name').fill(name);await page.locator('#account-gold').fill(String(gold));await page.locator('#account-quests').fill(String(quests));await page.locator('#save-account').click();}
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mtga-account-tracker.v1')));
 await add('Synthetic Main',5000,3);await add('Synthetic Alt',0,0);
 const first=page.locator('.card').nth(0), second=page.locator('.card').nth(1);
 assert.equal(await first.locator('.draft-row').count(),1);assert.equal(await second.locator('.draft-row').count(),0);
 // Reward presets work without an affordable draft or a recorded entry.
 const gemsButton = second.getByRole('button', {name:'Add gems for Synthetic Alt',exact:true});
 await gemsButton.click();
 assert.deepEqual(await page.locator('.gem-preset strong').allTextContents(), ['+50 gems','+100 gems','+200 gems','+300 gems','+450 gems','+650 gems','+850 gems','+950 gems']);
 await page.locator('.gem-preset').nth(7).click();
 await page.waitForFunction(()=>!document.querySelector('#gem-dialog').open);
 assert.equal((await stored()).accounts[1].gems,950);
 await page.waitForFunction(()=>document.activeElement?.dataset.action==='add-gems');
 assert.equal(await gemsButton.evaluate(el=>el===document.activeElement),true);
 assert.equal(await second.locator('.draft-row').count(),1);
 assert.equal((await stored()).accounts[0].gems,0);
 await gemsButton.click(); await page.keyboard.press('Escape');
 await gemsButton.click(); await page.locator('#close-gems').click();
 assert.equal((await stored()).accounts[1].gems,950);
 await page.locator('#draft-type').selectOption('premier');
 await gemsButton.click();
 assert.deepEqual(await page.locator('.gem-preset strong').allTextContents(), ['+50 gems','+100 gems','+250 gems','+1,000 gems','+1,400 gems','+1,600 gems','+1,800 gems','+2,200 gems']);
 await page.locator('.gem-preset').nth(2).focus(); await page.keyboard.press('Enter');
 assert.equal((await stored()).accounts[1].gems,1200);
 await gemsButton.click(); await page.locator('#gem-amount').fill('300');
 await page.getByRole('button',{name:'Add gems',exact:true}).click();
 assert.equal((await stored()).accounts[1].gems,1500);
 assert.equal(await second.locator('.draft-row').count(),1);
 await gemsButton.click(); await page.locator('#gem-amount').fill('0');
 await page.getByRole('button',{name:'Add gems',exact:true}).click();
 assert.equal(await page.locator('#gem-dialog').evaluate(el=>el.open),true);
 assert.equal((await stored()).accounts[1].gems,1500);
 await page.locator('#gem-amount').fill('9007199254740991');
 await page.getByRole('button',{name:'Add gems',exact:true}).click();
 assert.equal(await page.locator('#gem-error').isVisible(),true);
 for (const width of [320,400]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#gem-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 }
 await page.keyboard.press('Escape'); await page.reload();
 assert.equal((await stored()).accounts[1].gems,1500);
 await page.locator('#draft-type').selectOption('quick');
 await first.locator('.edit-button').focus();await page.keyboard.press('Enter');
 const gold=first.locator('[data-field="gold"]');await gold.fill('6000');await page.keyboard.press('Enter');assert.equal((await stored()).accounts[0].gold,6000);
 await gold.blur();assert.equal((await stored()).accounts[0].gold,6000);
 await gold.fill('-1');await gold.blur();assert.equal((await stored()).accounts[0].gold,6000);assert.equal(await first.locator('.inline-error').isVisible(),true);
 await first.locator('.edit-button').click();assert.equal(await gold.count(),1);assert.equal(await gold.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Escape');assert.equal(await gold.inputValue(),'6000');
 await first.getByRole('button',{name:'Increase wins for Synthetic Main',exact:true}).click();assert.equal((await stored()).accounts[0].wins,1);assert.equal((await stored()).accounts[0].gold,6000);
 await first.getByRole('button',{name:'Decrease quests for Synthetic Main',exact:true}).click();assert.equal((await stored()).accounts[0].quests,2);assert.equal((await stored()).accounts[0].gold,6000);
 // Unfinished input survives another account's update and a reset while focused.
 await gold.fill('12345');await gold.focus();
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mtga-account-tracker.v1'));s.accounts[1].wins=2;localStorage.setItem('mtga-account-tracker.v1',JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:'mtga-account-tracker.v1'}));});
 assert.equal(await gold.inputValue(),'12345');assert.equal(await gold.evaluate(el=>el===document.activeElement),true);
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mtga-account-tracker.v1'));s.lastReset-=86400000;localStorage.setItem('mtga-account-tracker.v1',JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:'mtga-account-tracker.v1'}));});
 assert.equal(await gold.inputValue(),'12345');assert.equal(await gold.evaluate(el=>el===document.activeElement),true);assert.equal((await stored()).accounts[0].wins,0);
 await page.keyboard.press('Enter');await first.locator('.edit-button').click();assert.equal(await first.locator('input').count(),0);assert.equal((await stored()).accounts[0].gold,12345);
 await page.locator('#draft-type').selectOption('premier');await first.locator('[data-action="draft-gold"]').click();assert.equal(await first.locator('.draft-row').count(),0);
 await first.locator('.edit-button').click();await first.locator('[data-field="gems"]').fill('1500');await first.locator('.edit-button').click();assert.equal(await first.locator('.draft-row').count(),1);
 await first.locator('[data-action="quest-750"]').click();assert.equal((await stored()).accounts[0].gold,3095);
 await first.locator('.edit-button').click();await first.locator('[data-field="name"]').fill('A'.repeat(80));await first.locator('[data-field="gold"]').fill('9007199254740991');await first.locator('.edit-button').click();
 for(const width of [320,400]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const row of await first.locator('.counter-row').all()){const children=await row.locator(':scope > *').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top+el.getBoundingClientRect().height/2));assert.ok(Math.max(...children)-Math.min(...children)<2);}
  const rects=await page.locator('.toolbar').evaluate(el=>Array.from(el.children,c=>c.getBoundingClientRect().top));assert.ok(Math.abs(rects[0]-rects[1])<3);
 }
 await first.locator('.edit-button').click();await first.getByRole('button',{name:'Remove account',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await first.getByRole('button',{name:'Remove account',exact:true}).evaluate(el=>el===document.activeElement),true);
 await first.getByRole('button',{name:'Remove account',exact:true}).click();await page.getByRole('button',{name:'Remove',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===1);
 await page.reload();assert.equal(await page.locator('.card').count(),1);
 assert.deepEqual(errors,[]);
 // Account text must never become HTML or executable script.
 await add('<img src=x onerror=alert(1)>',0,0);
 assert.equal(await page.locator('.account-name').last().textContent(),'<img src=x onerror=alert(1)>');
 assert.equal(await page.locator('.card img').count(),0);
 // Representative preview.
 await add('Synthetic Main',12500,3);await page.locator('#draft-type').selectOption('quick');
 if (process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 console.log('PASS: inline saving, invalid values, Escape/Done, no correction rewards, unfinished input/focus through storage updates and reset, draft visibility, quest rewards, 320/400px single-line controls, long names, maximum balances, keyboard and removal.');
} finally { await browser.close();server.close(); }
