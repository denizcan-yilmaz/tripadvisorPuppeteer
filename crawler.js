// const { url } = require("inspector");
const puppeteer = require("puppeteer");

async function extractReviews(page) {//helper function for extraction reviews

    let revs = [];
    const hotelName = await page.$eval('h1', element => element.textContent)

    let reviewTitles = await page.$$eval(".fCitC", elements=> elements.map(item=>item.textContent))

    let reviews = await page.$$eval("[class='XllAv H4 _a']", elements=> elements.map(item=>item.textContent))

    let date = await page.$$eval(".euPKI._R.Me.S4.H3", elements=> elements.map(item=>item.textContent))

    for(let i = 0; i<reviews.length; i++)
    {
        revs.push({'hotelName': hotelName, 'date': date[i],'reviewtitle' :reviewTitles[i], 'review': reviews[i]});
    }

    return revs;
}

async function skipCookies(page) { 
    try {
        await page.waitForTimeout(500);
        await page.$eval('[id="onetrust-accept-btn-handler"]', element=> element.click());           
        // console.log('pop up encountered and accepted');
    } catch (error) {
        // console.log('no pop up')
    }
}

async function scrapePage(page, url){
    await page.goto(url);
    let wholeReviews = [];

    while(1){
        let revs = await extractReviews(page);
        wholeReviews = [...wholeReviews, ...revs];
        await page.waitForTimeout(250);
        // await page.$eval('a.ui_button.nav.next.primary', elem => elem.click());

        let flag = 0;

        try {
            await page.$eval('a.ui_button.nav.next.primary', elem => elem.click());
        } catch (error) {
            flag = 1;
        }
        if (flag==1)break;

    }
    return wholeReviews;
}

async function getLinks(page, cityURL) {
    // const browser = await puppeteer.launch({ headless: false });
    // const page = await browser.newPage();
    hotelLinks = [];
    await page.goto(cityURL);
    await page.waitForTimeout(250);
    skipCookies(page);
    let flag = 1;

    while(1) {
        let hotelsPerPage = await page.$$eval(".listing_title > a", elements=> elements.map(item=>item.href));
        // console.log(hotelsPerPage.length)
        hotelLinks.push(...hotelsPerPage);
        // console.log(hotelLinks.length)
        try{
            await page.waitForTimeout(250);
            await page.$eval('a.nav.next.ui_button.primary', elem => elem.click());
        } catch (error) {
            flag = 0;
            // console.log('no button');
        }

        if (flag==0)break;
        console.log(hotelLinks.length);
    }
    hotelLinks = [...new Set(hotelLinks)];
    console.log(hotelLinks);
    return hotelLinks;
}

async function getCityURL(page) {
    let city = process.argv[2];
    let startURL = 'https://www.tripadvisor.com/Search?q='+city;
    await page.goto(startURL, {waitUntil: 'networkidle2'});
    await skipCookies(page);

    let link = await page.$eval('div.main_content.ui_column.is-12 > div > div:nth-child(2) > div > div > div > div > div > div', elem => elem.getAttribute('onclick'));
    // console.log(typeof link);

    link = link.split(",");

    await page.goto("https://www.tripadvisor.com" + link[3].replaceAll("'", "").trim());
    await page.waitForTimeout(100);

    // console.log("clicking");
    await page.$eval('main > div.crvbs > div.bOoyS._T > div > div > div:nth-child(1) > a', elem => elem.click());

    return page.url()

}


async function main(){
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let cityURL = await getCityURL(page);
    // console.log(cityURL);
    wholeRev = [];
    let urls = await getLinks(page, cityURL);
    console.log(urls.length);

    for (let i = 0; i< urls.length; i++){
        let rev = await scrapePage(page, urls[i]);
        wholeRev = [...new Set(wholeRev), ...new Set(rev)];
    }

    var fs = require('fs');
    fs.writeFile (`${process.argv[2]}.json`, JSON.stringify(wholeRev), function(err) {
        if (err) throw err;
        }
    );
    console.log(`Finished scraping. Check out the file ./${process.argv[2]}.json`)
    browser.close();

}

main();
