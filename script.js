let perfumes = JSON.parse(localStorage.getItem("perfumeInventory")) || [];

const perfumeForm = document.getElementById("perfumeForm");
const inventoryBody = document.getElementById("inventoryBody");
const searchInput = document.getElementById("searchInput");

const totalProducts = document.getElementById("totalProducts");
const totalUnits = document.getElementById("totalUnits");
const lowStock = document.getElementById("lowStock");
const emptyMessage = document.getElementById("emptyMessage");


function saveInventory() {
  localStorage.setItem(
    "perfumeInventory",
    JSON.stringify(perfumes)
  );
}


function formatPrice(price) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(price);
}


function getStockClass(quantity) {
  if (quantity === 0) {
    return "empty";
  }

  if (quantity <= 3) {
    return "low";
  }

  return "ok";
}


function renderInventory(filter = "") {
  inventoryBody.innerHTML = "";

  const filteredPerfumes = perfumes.filter((perfume) => {
    const searchText = `
      ${perfume.name}
      ${perfume.brand}
      ${perfume.size}
    `.toLowerCase();

    return searchText.includes(filter.toLowerCase());
  });

  emptyMessage.style.display =
    filteredPerfumes.length === 0
      ? "block"
      : "none";

  filteredPerfumes.forEach((perfume) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${perfume.name}</strong>
      </td>

      <td>${perfume.brand}</td>

      <td>${perfume.size}</td>

      <td>${formatPrice(perfume.price)}</td>

      <td>
        <span class="stock ${getStockClass(perfume.quantity)}">
          ${perfume.quantity}
        </span>
      </td>

      <td>
        <div class="actions">

          <button
            class="action-button increase"
            data-action="increase"
            data-id="${perfume.id}"
            title="Agregar una unidad"
          >
            +
          </button>

          <button
            class="action-button decrease"
            data-action="decrease"
            data-id="${perfume.id}"
            title="Quitar una unidad"
          >
            -
          </button>

          <button
            class="action-button delete"
            data-action="delete"
            data-id="${perfume.id}"
            title="Eliminar perfume"
          >
            Eliminar
          </button>

        </div>
      </td>
    `;

    inventoryBody.appendChild(row);
  });

  updateStats();
}


function updateStats() {
  totalProducts.textContent = perfumes.length;

  totalUnits.textContent = perfumes.reduce(
    (total, perfume) => total + perfume.quantity,
    0
  );

  lowStock.textContent = perfumes.filter(
    (perfume) => perfume.quantity <= 3
  ).length;
}


function addPerfume(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const brand = document.getElementById("brand").value.trim();
  const size = document.getElementById("size").value.trim();
  const quantity = Number(
    document.getElementById("quantity").value
  );
  const price = Number(
    document.getElementById("price").value
  );

  const perfume = {
    id: Date.now(),
    name,
    brand,
    size,
    quantity,
    price
  };

  perfumes.push(perfume);

  saveInventory();
  renderInventory();

  perfumeForm.reset();

  document.getElementById("quantity").value = 1;
}


function increaseStock(id) {
  const perfume = perfumes.find(
    (perfume) => perfume.id === id
  );

  if (!perfume) {
    return;
  }

  perfume.quantity++;

  saveInventory();
  renderInventory(searchInput.value);
}


function decreaseStock(id) {
  const perfume = perfumes.find(
    (perfume) => perfume.id === id
  );

  if (!perfume) {
    return;
  }

  if (perfume.quantity > 0) {
    perfume.quantity--;
  }

  saveInventory();
  renderInventory(searchInput.value);
}


function deletePerfume(id) {
  const perfume = perfumes.find(
    (perfume) => perfume.id === id
  );

  if (!perfume) {
    return;
  }

  const confirmed = confirm(
    `¿Quieres eliminar "${perfume.name}" del inventario?`
  );

  if (!confirmed) {
    return;
  }

  perfumes = perfumes.filter(
    (perfume) => perfume.id !== id
  );

  saveInventory();
  renderInventory(searchInput.value);
}


perfumeForm.addEventListener(
  "submit",
  addPerfume
);


searchInput.addEventListener(
  "input",
  () => {
    renderInventory(searchInput.value);
  }
);


inventoryBody.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "[data-action]"
    );

    if (!button) {
      return;
    }

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === "increase") {
      increaseStock(id);
    }

    if (action === "decrease") {
      decreaseStock(id);
    }

    if (action === "delete") {
      deletePerfume(id);
    }
  }
);


renderInventory();