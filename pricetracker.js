const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const CronJob = require('cron').CronJob;
const nodemailer = require('nodemailer');
const { Cluster } = require('puppeteer-cluster');

const urls = [
    "https://www.globus.ch/polo-ralph-lauren-jacke-1313051700525",
    "https://www.galerieslafayette.com/p/blouson+droit+en+coton+broderie-polo+ralph+lauren/90968113/3488?&utm_source=google+&utm_medium=cpc&utm_campaign=HM&gclsrc=ds&gclsrc=ds",
    "https://www.farfetch.com/ao/shopping/men/polo-ralph-lauren-logo-print-bomber-jacket-item-18991945.aspx"
];


async function track() {
    let job = new CronJob('*/60 * * * * *',function () {
        runClusterTask();
        },null,true,null,null,true);
    job.start();
}


async function  runClusterTask() {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 3,
        puppeteerOptions: {
            headless: false,
            defaultViewport: false,
        }
    })

    let currentPrice1 = 0;
    let currentPrice2 = 0;
    let currentPrice3 = 0;

    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);
        if (url === "https://www.globus.ch/polo-ralph-lauren-jacke-1313051700525") {
            await page.reload();
            let html = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(html);

            $('span.sc-kDrquE.htturO, span.sc-fvwjDU.gyiJRq', html).each(function () {
                let dollarPrice1 = $(this).text().trim();
                currentPrice1 = currencyConverter(dollarPrice1);
                console.log(currentPrice1);

            });
            await page.close();
        } else if (url === "https://www.galerieslafayette.com/p/blouson+droit+en+coton+broderie-polo+ralph+lauren/90968113/3488?&utm_source=google+&utm_medium=cpc&utm_campaign=HM&gclsrc=ds&gclsrc=ds") {
            await page.waitForTimeout(500);
            let html = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(html);

            $('#current-price', html).each(function () {
                let dollarPrice2 = $(this).text().trim();
                currentPrice2 = currencyConverter(dollarPrice2);
                console.log(currentPrice2);
            })

            await page.close();
        } else {
            await page.reload();
            let html = await page.evaluate(() => document.body.innerHTML);
            const $ = cheerio.load(html);

            $('.ltr-1db27g6-Heading').each(function () {
                let dollarPrice3 = $(this).text();
                currentPrice3 = currencyConverter(dollarPrice3);
                console.log(currentPrice3);


            })
            await page.close();
        }
    });


    for (const url of urls) {
        cluster.queue(url);
    }

    //error handler
    cluster.on('taskerror', (err, data) => {
        console.log(`Error crawling ${data}: ${err.message}`);
    });

    await cluster.idle();
    await cluster.close();

    priceAnalysis(currentPrice1, currentPrice2, currentPrice3);
}

async function sendNotif(price,index) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'jababen316@gmail.com',
            pass: 'uhwt bspm ymad gfcs'
        }
    });

    let textToSend = "The minimum price is " + price + " .Check it out here: " + urls[index];

    console.log();

    let info = await transporter.sendMail({
        from: '"Price Tracker" <jababen316@gmail.com>',
        to: "jababen316@gmail.com",
        subject: 'UPDATE',
        text: textToSend,
    });
    console.log("message sent successfully");
}


function priceAnalysis(...currentPrices) {

    const availablePrices = currentPrices.filter(price => !isNaN(price));
    

    if (availablePrices.length > 0) {
        const minimumPrice = Math.min(...availablePrices);
        const index = currentPrices.indexOf(minimumPrice);
        sendNotif(minimumPrice,index);
    } else {
        console.log("No available price for analysis");
    }
}


function currencyConverter(amount) {
    
    const exchangeRates = {
        $ : 0.92,   
        CHF: 1.04
    };
    
    const currencySymbols = {
        '$': 'USD',
        '£': 'GBP',
        'CHF': 'CHF'
    }

    let currencySymbol = '';
    for (const symbol in currencySymbols) {
        if (amount.includes('€')) {
            return Number(amount.replace(/[^\d.,]/g, "").replace(",", "."));
        } else if (amount.includes(symbol)) {
            currencySymbol = symbol;
            const numericVal = Number(amount.replace(/[^\d.,]/g, "").replace(",", "."));
            const valInEur = numericVal * exchangeRates[currencySymbol];
            return valInEur;
        }
    }
}

track();
