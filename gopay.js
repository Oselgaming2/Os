const axios = require('axios');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs').promises; // Menggunakan fs/promises untuk async/await
const path = require('path');

const formUrl = 'https://www.joinmarriottbonvoy.com/gojek/s/EN-GB';
const emailFilePath = path.join(__dirname, 'email.txt');

// Base headers untuk meniru browser.
const baseHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

/**
 * TAHAP 1: Mengambil halaman, mendapatkan cookies dan token form.
 * Fungsi ini akan terus mencoba hingga berhasil.
 */
async function getSessionData() {
    console.log('[Tahap 1] Memulai pengambilan cookies dan token formulir...');
    let attempts = 0;
    while (true) {
        attempts++;
        try {
            console.log(`  (Percobaan #${attempts}) Melakukan GET request ke ${formUrl}`);
            const response = await axios.get(formUrl, { headers: baseHeaders });
            
            const cookies = response.headers['set-cookie'];
            if (!cookies || cookies.length === 0) {
                throw new Error('Server tidak mengirimkan cookie (set-cookie header tidak ditemukan).');
            }
            const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

            const $ = cheerio.load(response.data);
            const viewState = $('#__VIEWSTATE').val();
            const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();
            const eventValidation = $('#__EVENTVALIDATION').val();

            if (!viewState || !viewStateGenerator || !eventValidation) {
                throw new Error('Gagal mengambil salah satu token: __VIEWSTATE, __VIEWSTATEGENERATOR, atau __EVENTVALIDATION.');
            }
            
            console.log('[Tahap 1] Sukses! Cookies dan semua token berhasil didapatkan.');
            return { cookieString, viewState, viewStateGenerator, eventValidation };

        } catch (error) {
            console.error(`  [Error di Tahap 1, Percobaan #${attempts}] ${error.message}`);
            // Tanpa jeda, langsung coba lagi
        }
    }
}

/**
 * TAHAP 2: Mengirimkan (submit) formulir.
 * Mengembalikan `true` jika sukses, `false` jika gagal dan harus dicoba lagi.
 * @param {string} email - Alamat email yang akan didaftarkan.
 * @param {object} sessionData - Objek berisi cookie dan token dari getSessionData().
 */
async function submitForm(email, sessionData) {
    console.log(`\n[Tahap 2] Memulai proses submit formulir untuk: ${email}`);
    
    const postHeaders = {
        ...baseHeaders,
        'content-type': 'application/x-www-form-urlencoded',
        'cookie': sessionData.cookieString,
        'origin': 'https://www.joinmarriottbonvoy.com',
        'referer': formUrl,
        'sec-fetch-site': 'same-origin',
    };

    const dataPayload = {
        '__EVENTTARGET': 'ctl00$PartialEnrollFormPlaceholder$partial_enroll$EnrollButton',
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        '__VIEWSTATE': sessionData.viewState,
        '__VIEWSTATEGENERATOR': sessionData.viewStateGenerator,
        '__SCROLLPOSITIONX': '0',
        '__SCROLLPOSITIONY': '0',
        '__EVENTVALIDATION': sessionData.eventValidation,
        'ctl00$UpperRight$LanguagePicker$ctlLanguage': 'EN-GB',
        'ctl00$UpperRight$LanguagePicker$hdnpromotionID': '3841',
        'ctl00$UpperRight$LanguagePicker$hdnCtycode': 'EN-GB',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$first_name': 'Apep', // Ganti jika perlu
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$last_name': 'Rustandim', // Ganti jika perlu
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$email_address': email,
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$country': 'ID',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$sms_consent': 'on',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$phone_number_country': '62',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$phone_number_subscriber': '',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$chk_mi': 'on',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$chk_tp': 'on',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$ctlConsent$ctlAgree': 'on',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$hdn_send_email': 'True',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$hdn_send_sms': 'False',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$hdn_list_mode': '0',
        'ctl00$PartialEnrollFormPlaceholder$partial_enroll$hdn_customer_key': '',
    };
    
    let attempts = 0;
    while (true) {
        attempts++;
        console.log(`  (Percobaan #${attempts}) Mengirim form untuk email: ${email}...`);
        
        try {
            const response = await axios.post(formUrl, qs.stringify(dataPayload), { headers: postHeaders });
            
            // Logika deteksi keberhasilan mungkin perlu disesuaikan.
            // Di sini kita asumsikan jika tidak ada pesan error spesifik, maka berhasil.
            if (response.data && response.data.includes('The service is unavailable.')) {
                console.error('  [Gagal] Server merespons: "The service is unavailable." Mencoba lagi...');
            } else if (response.status === 200) { // Asumsi status 200 dan tidak ada pesan error adalah sukses
                console.log(`  [Sukses] Form untuk ${email} berhasil dikirim!`);
                return true; // Mengembalikan true menandakan sukses
            }
        } catch (error) {
            console.error(`  [Error di Tahap 2, Percobaan #${attempts}] ${error.message}. Mencoba lagi...`);
        }
    }
}

/**
 * Membaca email dari file email.txt.
 * @returns {Promise<string[]>} Array berisi daftar email.
 */
async function readEmailsFromFile() {
    try {
        const data = await fs.readFile(emailFilePath, 'utf8');
        // Memfilter baris kosong dan membersihkan spasi
        return data.split(/\r?\n/).filter(line => line.trim() !== '');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: File ${emailFilePath} tidak ditemukan.`);
            console.log("Silakan buat file email.txt di direktori yang sama dengan skrip ini.");
            return []; // Kembalikan array kosong jika file tidak ada
        }
        console.error(`Gagal membaca file email: ${error.message}`);
        return [];
    }
}

/**
 * Menghapus email yang sudah berhasil dari file email.txt.
 * @param {string} emailToRemove - Email yang akan dihapus.
 */
async function removeEmailFromFile(emailToRemove) {
    try {
        let emails = await readEmailsFromFile();
        const updatedEmails = emails.filter(email => email.trim() !== emailToRemove.trim());
        await fs.writeFile(emailFilePath, updatedEmails.join('\n'), 'utf8');
        console.log(`INFO: Email ${emailToRemove} telah dihapus dari email.txt.`);
    } catch (error) {
        console.error(`Error saat memperbarui email.txt: ${error.message}`);
    }
}

/**
 * Fungsi utama untuk mengorkestrasi seluruh alur bot.
 */
async function startBot() {
    console.log("===== MEMULAI BOT PENDAFTARAN MARIOTT BONVOY =====");

    // 1. Ambil session data sekali saja
    const sessionData = await getSessionData();

    // 2. Loop utama untuk memproses setiap email
    while (true) {
        let emailsToProcess = await readEmailsFromFile();

        if (emailsToProcess.length === 0) {
            console.log("\nSemua email dalam email.txt telah berhasil diproses.");
            break; // Keluar dari loop jika tidak ada email lagi
        }

        console.log(`\nDaftar email yang akan diproses: ${emailsToProcess.length}`);
        const currentEmail = emailsToProcess[0]; // Ambil email pertama dari daftar

        // 3. Coba daftarkan email
        const isSuccess = await submitForm(currentEmail, sessionData);

        // 4. Jika berhasil, hapus email dari file
        if (isSuccess) {
            await removeEmailFromFile(currentEmail);
        } else {
            // Jika submitForm gagal secara permanen (yang mana dalam kasus ini tidak mungkin karena loop tak terbatas),
            // Anda mungkin ingin memindahkannya ke file lain atau berhenti.
            // Untuk saat ini, bot akan terus mencoba pada email yang sama di iterasi berikutnya.
            console.log(`Gagal memproses ${currentEmail}, akan dicoba lagi pada siklus berikutnya.`);
        }
    }

    console.log("\n===== BOT SELESAI =====");
}

// Jalankan bot
startBot().catch(e => {
    console.error("Bot berhenti karena error fatal yang tidak terduga:", e.message);
});