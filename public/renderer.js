let users = [];
let globalCurrentSelectedUserId = null;

async function refreshData() {  // load data
  if (!window.api) {
    console.error("API (Preload-Skript) ist noch nicht bereit");
    return;
  }

  try {
    users = await window.api.getUsers();

    // confirm its array
    if (!Array.isArray(users)) {
      console.warn("getUsers hat kein Array geliefert:", users);
      users = [];
    }

    const userSelect = document.getElementById("userSelect");

    // fill user dropdown
    let optionsUserSelect = `
      <option value="" disabled selected hidden>-- Bitte wähle einen Nutzer --</option>
    `;
    optionsUserSelect += users
      .map((u) => `<option value="${u.id}">${u.name}</option>`)
      .join("");
    optionsUserSelect += `
      <option value="ADD_NEW" style="font-weight: bold; color: #007bff;">
        + Neuen Benutzer anlegen
      </option>
    `;
    userSelect.innerHTML = optionsUserSelect;
  } catch (err) {
    console.error("Fehler beim Laden der Daten:", err);
  }
}

async function handleUserSelection(selectElement) { // reaction when dropdown is changed
  const selectedUserID = selectElement.value;
  const userCreateScreen = document.getElementById("userCreateScreen");
  const customUserScreen = document.getElementById("userscreen"); 

  if (selectedUserID === "ADD_NEW") {
    // hide userscreen and show createscreen
    userCreateScreen.hidden = false;
    customUserScreen.hidden = true; 
  } else if (!selectedUserID) {
    // hide everything if empty
    userCreateScreen.hidden = true;
    customUserScreen.hidden = true;
  } else {
    // user is selected
    userCreateScreen.hidden = true;

    const selectedUser = users.find((u) => u.id == selectedUserID);

    if (selectedUser) {
      globalCurrentSelectedUserId = selectedUser.id;
      // calculate balances
      const totalHours = await window.api.getBalance(selectedUser.id);
      const totalMoney = totalHours * (selectedUser.lohn || 0);

      document.getElementById("Stundenkonto").textContent =
        totalHours.toFixed(2) + " Std.";
      document.getElementById("Geldkonto").textContent =
        totalMoney.toFixed(2) + " €";

      loadTransactions(selectedUser.id);
      
      customUserScreen.hidden = false;
    }
  }
}

async function createUser() { // create user confirmed
  const name = document.getElementById("userName").value;
  const hourlyWage = document.getElementById("userRate").value;
  if (!name) return alert("Bitte einen Namen eingeben");
  if (!hourlyWage) return alert("Bitte Stundenlohn eingeben");

  const formattedRate = hourlyWage.replace(",", ".");

  const wage = parseFloat(formattedRate);

  if (isNaN(wage)) {
    return alert("Bitte einen gültigen Stundenlohn als Zahl eingeben!");
  }

  await window.api.createUser(name, wage);

  //reset screen
  document.getElementById("userName").value = "";
  document.getElementById("userRate").value = "";

  document.getElementById("userCreateScreen").hidden = true;
  document.getElementById("userSelect").value = "";

  refreshData();
}

async function addStunden() { // show addHour popup
  const modal = document.getElementById("addStundenpopup");
  modal.showModal();
}

async function closeModal() { // cancel addHour popup
  const modal = document.getElementById("addStundenpopup");
  modal.close();
}

async function addUeberweisung() { // show addUeberweisung popup
  const modal = document.getElementById("addUeberweisungpopup");
  modal.showModal();
}

async function closeUEModal() { // cancel addUeberweisung popup
  const modal = document.getElementById("addUeberweisungpopup");
  modal.close();
}

async function saveModalData() { // confirm addHour popup
  const modal = document.getElementById("addStundenpopup");
  const stundenzahl = document.getElementById("timeInput").value;
  const dateInp = document.getElementById("dateInput").value;

  if (!stundenzahl) return alert("Bitte Stundenzahl eingeben");
  if (!dateInp) return alert("Bitte Datum auswählen");
  const formattedtime = stundenzahl.replace(",", ".");
  const time = parseFloat(formattedtime);
  if (isNaN(time)) return alert("Bitte Zahl eingeben");
  await window.api.addTimeEntry({
    userId: globalCurrentSelectedUserId,
    time: time,
    date: dateInp,
  });
  closeModal();
  handleUserSelection(document.getElementById("userSelect"));
}

async function saveUEModalData() { // confirm addUeberweisung popup
  const modal = document.getElementById("addUeberweisungpopup");
  const ueberweisungsBetrag =
    document.getElementById("ueberweisungsInput").value;
  const dateInp = document.getElementById("dateUEInput").value;

  if (!ueberweisungsBetrag) return alert("Bitte Überweisungsbetrag eingeben");
  if (!dateInp) return alert("Bitte Datum auswählen");
  const formattedtime = ueberweisungsBetrag.replace(",", ".");
  const time = parseFloat(formattedtime);
  if (isNaN(time)) return alert("Bitte Zahl eingeben");
  await window.api.addUeberweisung({
    userId: globalCurrentSelectedUserId,
    geld: time,
    date: dateInp,
  });
  closeUEModal();
  handleUserSelection(document.getElementById("userSelect"));
}

async function deleteClick(){ // show deletion popup
  const modal = document.getElementById("confirmation");
  modal.showModal();
}

async function deleteCancel(params) { // cancel deletion popup
  const modal = document.getElementById("confirmation");
  modal.close();
}

async function deleteConfirmed() { // confirm deletion popup
  if (!globalCurrentSelectedUserId) return alert("Kein Nutzer ausgewählt!");
  
  await window.api.deleteUser(globalCurrentSelectedUserId);
  globalCurrentSelectedUserId = "";
  const modal = document.getElementById("confirmation");
  document.getElementById("userSelect").value = "";
  modal.close();
  document.getElementById("userscreen").hidden = true;
  refreshData();
}

async function loadTransactions(userId) {
  const transactions = await window.api.getTransactions(userId);
  const tbody = document.getElementById("transactionList");

  tbody.innerHTML = ""; 

  if (transactions.length === 0) {
    // when empty
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Keine Transaktionen vorhanden.</td></tr>`;
  } else {
    transactions.forEach((t) => {
      const dateFormatted = new Date(t.date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const isPositive = t.amountInEuro >= 0;
      const amountClass = isPositive ? "amount-plus" : "amount-minus";
      const formattedAmount =
        (isPositive ? "+ " : "") + t.amountInEuro.toFixed(2) + " €";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${dateFormatted}</td>
        <td>${t.description}</td>
        <td class="${amountClass}" style="text-align: right;">${formattedAmount}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Daten beim Laden anzeigen
window.addEventListener("DOMContentLoaded", refreshData);