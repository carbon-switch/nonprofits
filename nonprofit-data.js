const express = require("express");
const axios = require("axios");
const Bottleneck = require("bottleneck");


// set up app
const app = express();
const PORT = process.env.PORT || 3000;

// import states json file
const states = require("./states_titlecase.json")

// rate limiter
// used to not get blocked by ProPublica
const limiter = new Bottleneck({
    maxConcurrent: 1,
});

// run getAllResults for all states
function crawl () {
    for (let i = 0; i < states.length; i++) {
        getAllResults(states[i].abbreviation)
    }
}


async function getAllResults (state, page = 0) {

    const config = {
        method: 'get',
        headers: {},
    }
    const param = `https://projects.propublica.org/nonprofits/api/v2/search.json?
        ntee[id]=3&
        state[id]=${state}&
        page=${page}`

    try {
        const response = await limiter.schedule(() => axios(param, config))
        const orgsArray = response.data.organizations
        const totalPages = response.data.num_pages

        if (page < totalPages) {
            // log info to console
            console.log(totalPages)

            // add org to firebase
            for (let i=0; i < orgsArray.length; i++) {
                const ein = orgsArray[i].ein
                const name = orgsArray[i].name
                const city = orgsArray[i].city
                const state = orgsArray[i].state
                const ntee = orgsArray[i].ntee_code

                firestore
                    .collection("nonprofits")
                    .doc(String(ein))
                    .set({
                        ein,
                        name,
                        city, 
                        state,
                        ntee
                    })
                    .then(
                        console.log("SUCCESS! Added:", name)
                    )
                    .catch((err) => console.log(err))
            }

            // paginate
            page++
            getAllResults(state, page)
        }

    }
    catch (err) {
        console.log(err)
    }
}

// get all docs in collection
// note: was using Firebase as my database to store nonprofit data
async function getDocuments () {
    const citiesRef = firestore.collection('nonprofits');
    const snapshot = await citiesRef.get();
    console.log(snapshot)
    snapshot.forEach(doc => {
        console.log(doc.data());
    });
}

// charity API config
const charityConfig = {
    method: 'get',
    headers: {
        apikey: "live-Al51CDc8tmqEV_MeqZfK1g-IFVsGqZ375FeUhFuf2eC3TQoodJwI2mBfrgUECT6tRUq7Wvl5xaGzR7mb"
    },
}

// get revenue data from EIN
async function getRevenue (ein) {
    
    const param = `https://api.charityapi.org/api/organizations/${ein}`

    try {
        const response = await axios(param, charityConfig)
        const revenue = response.data.data.revenue_amt
        const income = response.data.data.income_amt
        const assets = response.data.asset_amt

        totalRevenue = totalRevenue + revenue
        console.log(totalRevenue)
        console.log(response)

        // firestore
        //     .collection("nonprofits")
        //     .doc(String(ein))
        //     .set({
        //         revenue,
        //         income,
        //     })
        //     .then(
        //         console.log("SUCCESS! Updated", ein)
        //     )
    }
    catch (err) {
        console.log(err)
    }

}

async function countRevenue (taxCode) {

    const nonProfits = firestore.collection('nonprofits');
    const snapshot = await nonProfits.where('ntee', '==', "C99").get();
    snapshot.forEach(doc => {
        const ein = doc.data().ein;
        getRevenue(ein)
    });

}

// variable to store counter data
let totalRevenue = 0

// run CharityAPI crawler
// countRevenue()
getRevenue()



// start server
app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`);
});