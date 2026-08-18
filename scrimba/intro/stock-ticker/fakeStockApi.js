function getStockData() {
    return {
        name: 'QtechAI',
        sym: 'QTA',
        price: parseFloat(Math.random() * 3).toFixed(2), 
        // not want am / pm
        time: new Date().toLocaleTimeString().replace(' AM', '').replace(' PM', '')
    }
}
  
export { getStockData }