import { getStockData } from './fakeStockApi.js'

/*
App requirements:
 - The app should display the name, symbol, and 
   price of the stock, with a timestamp as per the 
   screenshot. 
 - The triangle compares the current stock price to 
   its previous price. If the price has increased, it 
   should be a green triangle pointing up, if the price 
   has decreased it should be a red triangle pointing 
   down, and if there has been no change it should be a 
   grey triangle pointing to the right.
 - The price should update every 1.5 seconds. 
*/

/*
Challenge:
  1. Find a way to get fresh stock data every 1.5 seconds.
  2. Call the renderStockTicker function with the fresh data.
  3. Add logic to renderStockTicker to display the correct 
     information.
  ⚠️ You will need to write code here in index.js and in
   fakeStockAPI.js.
*/

function updateStockTicker(time = 1.5) {
    let stockData = getStockData();
    renderStockTickerFirstTime(stockData);

    setInterval(() => {
        stockData = getStockData();
        renderStockTicker(stockData);
    }, time * 1000)
}

function renderStockTickerFirstTime(stockData) {
    const stockDisplayName = document.getElementById('name')
    const stockDisplaySymbol = document.getElementById('symbol')
    const stockDisplayPrice = document.getElementById('price')
    const stockDisplayPriceIcon = document.getElementById('price-icon')
    const stockDisplayTime = document.getElementById('time')


    stockDisplayPriceIcon.innerText = '►'
    stockDisplayPriceIcon.style.color = 'grey'
    stockDisplayName.innerText = stockData.name
    stockDisplaySymbol.innerText = stockData.sym
    stockDisplayPrice.innerText = stockData.price
    stockDisplayTime.innerText = stockData.time
}


function renderStockTicker(stockData) {
    const stockDisplayName = document.getElementById('name')
    const stockDisplaySymbol = document.getElementById('symbol')
    const stockDisplayPrice = document.getElementById('price')
    const stockDisplayPriceIcon = document.getElementById('price-icon')
    const stockDisplayTime = document.getElementById('time')

    if (stockData && stockData.price) {
        if(stockData.price > parseFloat(stockDisplayPrice.innerText)) {
            stockDisplayPriceIcon.innerText = '▲'
            stockDisplayPriceIcon.style.color = 'green'
        } else if (stockData.price < parseFloat(stockDisplayPrice.innerText)) {
            stockDisplayPriceIcon.innerText = '▼'
            stockDisplayPriceIcon.style.color = 'red'
        } else {
            stockDisplayPriceIcon.innerText = '►'
            stockDisplayPriceIcon.style.color = 'grey'
        }

        stockDisplayName.innerText = stockData.name
        stockDisplaySymbol.innerText = stockData.sym
        stockDisplayPrice.innerText = stockData.price
        stockDisplayTime.innerText = stockData.time
    }
}


updateStockTicker(1.5);