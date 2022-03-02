const puppeteer = require("puppeteer");
const redis = require("redis");


async function extractReviews(page, client) {

    let revs = [];

    let rating = await page.$$eval("div[class='emWez F1'] > span", elements=> elements.map(item=>item.getAttribute("class").slice(-2,-1)));

    let locationName = await page.$eval(".KeVaw", element=> element.textContent.split(' '))
    locationName = locationName[locationName.length-1];


    url = page.url().split('-');
    locationId = url[2].slice(1);
    hotelId = url[1].slice(1);

    const hotelName = await page.$eval('h1', element => element.textContent)

    let reviewTitles = await page.$$eval(".fCitC", elements=> elements.map(item=>item.textContent))

    let reviews = await page.$$eval("[class='XllAv H4 _a']", elements=> elements.map(item=>item.textContent))

    let date = await page.$$eval(".euPKI._R.Me.S4.H3", elements=> elements.map(item=>item.textContent))

    let author = await page.$$eval(".ui_header_link.bPvDb", elements=> elements.map(item=>item.textContent))

    let revIds = await page.$$eval(".cqoFv._T", elements=> elements.map(item=>item.getAttribute("data-reviewid")))

    // console.log(revIds);

    for(let i = 0; i<reviews.length; i++)
    {
        revs.push({ 'reviewId': revIds[i],
                    'hotelName': hotelName, 
                    'date': date[i].slice(14),
                    'rating': rating[i],    
                    'reviewTitle' :reviewTitles[i], 
                    'review': reviews[i], 
                    'reviewAuthor': author[i],
                    'locationId': locationId,
                    'locationName': locationName,
                    'hotelId': hotelId
                });

        await client.HSET(revIds[i], 'hotelName', hotelName);
        await client.HSET(revIds[i], 'hotelId', hotelId);
        await client.HSET(revIds[i], 'locationName', locationName);
        await client.HSET(revIds[i], 'locationId', locationId);
        await client.HSET(revIds[i], 'date', date[i]);
        await client.HSET(revIds[i], 'rating', rating[i]);
        await client.HSET(revIds[i], 'reviewTitle', reviewTitles[i]);
        await client.HSET(revIds[i], 'review', reviews[i]);
        await client.HSET(revIds[i], 'reviewAuthor', author[i]);


    }
    
    return revs;

    // console.log(revs);
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

async function scrapePage(page, url, client){
    await page.goto(url);
    let wholeReviews = [];

    while(1){
        let revs = await extractReviews(page, client);
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
        // console.log(hotelLinks.length);
    }
    hotelLinks = [...new Set(hotelLinks)];
    // console.log(hotelLinks);
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
    // console.log(urls.length);

    const client = redis.createClient();

    client.on('connect', function() {
        console.log('Connected');
    })

    client.connect();


    for (let i = 0; i< urls.length; i++){
        let rev = await scrapePage(page, urls[i], client);
        wholeRev = [...new Set(wholeRev), ...new Set(rev)];
    }

    var fs = require('fs');
    fs.writeFile (`${process.argv[2]}.json`, JSON.stringify(wholeRev), function(err) {
        if (err) throw err;
        }
    );
    console.log(`Finished scraping. Check out the file ./${process.argv[2]}.json`)
    browser.close();
    client.disconnect();

}

main();
