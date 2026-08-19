// Throwaway file to smoke-test the gemini-review workflow.
// Contains deliberate defects; delete this file with the PR.

function getLastItems(arr, n) {
  // off-by-one: returns n+1 items
  return arr.slice(arr.length - n - 1);
}

async function fetchUser(id) {
  // no error handling, and interpolates straight into the path
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

function totalPrice(items) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price;
  }
  return total;
}

module.exports = { getLastItems, fetchUser, totalPrice };
