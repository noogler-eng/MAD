import { contactsArr } from './contactData.js'

/*
Challenge:
1. Wire up this search pattern app so that inputting 
   a full or partial name brings up the matching     
   contact or contacts.
*/

const patternSearchInput = document.getElementById('pattern-search-input')
const patternSearchSubmit = document.getElementById('pattern-search-submit')
const contactDisplay = document.getElementById('contact-display')

function renderContact(contactObj) {
    const contactCard = document.createElement('aside')
    contactCard.classList.add('contact-card')

    document.getElementById('contact-display').appendChild(contactCard)
    contactCard.innerHTML = `
        <p>${contactObj.name}</p>
        <p>Email: ${contactObj.email}</p>
        <p>Phone: ${contactObj.phone}</p>
    `
}

patternSearchSubmit.addEventListener('click', () => {
    contactDisplay.innerHTML = ''; 
    const cardsToDisplay = contactsArr.filter((card) => {
        return card.name.toLowerCase().includes(patternSearchInput.value.toLowerCase());
    });

    cardsToDisplay.forEach(renderContact);
})