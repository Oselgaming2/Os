const fs = require('fs').promises;
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver');

const formUrl = 'https://www.joinmarriottbonvoy.com/gojek/s/EN-GB';
const emailFilePath = path.join(__dirname, 'email.txt');

async function readEmailsFromFile() {
    try {
        const data = await fs.readFile(emailFilePath, 'utf8');
        return data.split(/\r?\n/).filter(e => e.trim() !== '');
    } catch {
        return [];
    }
}

async function removeEmailFromFile(emailToRemove) {
    const list = await readEmailsFromFile();
    const updated = list.filter(e => e.trim() !== emailToRemove.trim());
    await fs.writeFile(emailFilePath, updated.join('\n'), 'utf8');
    console.log(`[-] ${emailToRemove} dihapus dari email.txt`);
}

async function fillAndSubmit(driver, email) {
    await driver.get(formUrl);
    await driver.wait(until.elementLocated(By.id('__VIEWSTATE')), 10000);

    // Isi form
    await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$first_name')).sendKeys('Apep');
    await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$last_name')).sendKeys('Rustandim');
    await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$email_address')).sendKeys(email);
    await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$country')).sendKeys('Indonesia');

    // Checkbox & Agreement
    const cek1 = await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$chk_mi'));
    const cek2 = await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$chk_tp'));
    const cek3 = await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$ctlAgree'));
    if (!(await cek1.isSelected())) await cek1.click();
    if (!(await cek2.isSelected())) await cek2.click();
    if (!(await cek3.isSelected())) await cek3.click();

    // Submit
    const button = await driver.findElement(By.name('ctl00$PartialEnrollFormPlaceholder$partial_enroll$EnrollButton'));
    await button.click();

    // Tunggu response
    await driver.sleep(3000); // ganti dengan waitForSuccess jika perlu

    const page = await driver.getPageSource();
    if (!page.includes('The service is unavailable')) {
        console.log(`[✓] Sukses daftar: ${email}`);
        return true;
    } else {
        console.log(`[✘] Gagal: Server sedang tidak tersedia.`);
        return false;
    }
}

async function startBot() {
    const emails = await readEmailsFromFile();
    if (emails.length === 0) {
        console.log('Tidak ada email untuk diproses.');
        return;
    }

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(
            // Headless mode, uncomment jika tidak ingin membuka jendela
            require('selenium-webdriver/chrome').Options().headless().addArguments(
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1200,800',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
            )
        )
        .build();

    try {
        for (let email of emails) {
            console.log(`\n=== Proses email: ${email}`);
            try {
                const success = await fillAndSubmit(driver, email);
                if (success) await removeEmailFromFile(email);
            } catch (err) {
                console.log(`[!] Error proses ${email}:`, err.message);
            }
        }
    } finally {
        await driver.quit();
        console.log('Selesai.');
    }
}

startBot();
