let perfumes = [];
let sellerCatalog = [];
let excelImportRows = [];


/* ======================================
   UTILIDADES GENERALES
====================================== */

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function normalizeForComparison(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


/*
 * Orden natural de códigos.
 *
 * Ejemplo:
 * D12-1
 * D12-2
 * D12-10
 * D12-11
 *
 * En vez de:
 * D12-1
 * D12-10
 * D12-11
 * D12-2
 */
function compareCodes(codeA, codeB) {
  return String(codeA ?? "")
    .localeCompare(
      String(codeB ?? ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base"
      }
    );
}


function sortPerfumesByCode(items) {
  return [...items].sort(
    (a, b) =>
      compareCodes(
        a.code,
        b.code
      )
  );
}


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatCurrency(value) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN"
    }
  ).format(
    Number(value) || 0
  );
}


function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}


function roundMoney(value) {
  return Math.round(
    (
      Number(value) +
      Number.EPSILON
    ) * 100
  ) / 100;
}


/* ======================================
   TOAST
====================================== */

function showToast(message) {
  let toast =
    document.getElementById(
      "toast"
    );

  let toastMessage =
    document.getElementById(
      "toastMessage"
    );


  if (!toast) {
    toast =
      document.createElement(
        "div"
      );

    toast.id = "toast";
    toast.className = "toast";

    toastMessage =
      document.createElement(
        "span"
      );

    toastMessage.id =
      "toastMessage";

    toast.appendChild(
      toastMessage
    );

    document.body.appendChild(
      toast
    );
  }


  if (!toastMessage) {
    return;
  }


  toastMessage.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    showToast.timeout
  );


  showToast.timeout =
    setTimeout(
      () => {
        toast.classList.remove(
          "show"
        );
      },
      2800
    );
}


/* ======================================
   MAPEO PERFUMES
====================================== */

function mapPerfumeFromDatabase(row) {
  return {
    id: row.id,

    name: row.name,

    brand: row.brand,

    category: row.category,

    size: row.size,

    purchasePrice:
      Number(
        row.purchase_price
      ) || 0,

    price:
      Number(
        row.price
      ) || 0,

    quantity:
      Number(
        row.quantity
      ) || 0,

    code: row.code,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


/* ======================================
   PERFIL SUPABASE
====================================== */

async function getProfile(userId) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, full_name, role, active"
      )
      .eq(
        "id",
        userId
      )
      .single();


  if (error) {
    console.error(
      "Error obteniendo perfil:",
      error
    );

    throw new Error(
      "No se pudo obtener el perfil."
    );
  }


  return data;
}


/* ======================================
   SESIÓN
====================================== */

async function getAuthenticatedUser() {
  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();


  if (error) {
    console.error(
      "Error obteniendo sesión:",
      error
    );

    return null;
  }


  return (
    data.session?.user ||
    null
  );
}


/* ======================================
   CACHE DEL PERFIL
====================================== */

function cacheProfile(profile) {
  sessionStorage.setItem(
    "duvant12_profile",
    JSON.stringify(profile)
  );


  document.documentElement.dataset.role =
    profile.role;
}


function clearCachedProfile() {
  sessionStorage.removeItem(
    "duvant12_profile"
  );


  delete document
    .documentElement
    .dataset
    .role;
}


/* ======================================
   LOGIN
====================================== */

async function initializeLoginPage() {
  const loginForm =
    document.getElementById(
      "loginForm"
    );


  if (!loginForm) {
    return;
  }


  const emailInput =
    document.getElementById(
      "loginEmail"
    );


  const passwordInput =
    document.getElementById(
      "loginPassword"
    );


  const errorElement =
    document.getElementById(
      "loginError"
    );


  const loginButton =
    document.getElementById(
      "loginButton"
    );


  const togglePassword =
    document.getElementById(
      "togglePassword"
    );


  const currentUser =
    await getAuthenticatedUser();


  if (currentUser) {
    try {
      const profile =
        await getProfile(
          currentUser.id
        );


      if (profile.active) {
        cacheProfile(
          profile
        );


        window.location.href =
          profile.role === "admin"
            ? "index.html"
            : "vendedores.html";


        return;
      }

    } catch (error) {
      console.error(
        error
      );
    }
  }


  if (togglePassword) {
    togglePassword.addEventListener(
      "click",
      () => {
        const hidden =
          passwordInput.type ===
          "password";


        passwordInput.type =
          hidden
            ? "text"
            : "password";


        togglePassword.textContent =
          hidden
            ? "Ocultar"
            : "Ver";
      }
    );
  }


  loginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      errorElement.textContent =
        "";


      loginButton.disabled =
        true;


      loginButton.textContent =
        "Ingresando...";


      const email =
        emailInput.value
          .trim()
          .toLowerCase();


      const password =
        passwordInput.value;


      try {
        const {
          data,
          error
        } =
          await supabaseClient
            .auth
            .signInWithPassword({
              email,
              password
            });


        if (error) {
          console.error(
            "Error Supabase:",
            error
          );


          errorElement.textContent =
            error.message;


          return;
        }


        const profile =
          await getProfile(
            data.user.id
          );


        if (!profile.active) {
          await supabaseClient
            .auth
            .signOut();


          clearCachedProfile();


          errorElement.textContent =
            "Esta cuenta está desactivada.";


          return;
        }


        cacheProfile(
          profile
        );


        window.location.href =
          profile.role === "admin"
            ? "index.html"
            : "vendedores.html";

      } catch (error) {
        console.error(
          error
        );


        errorElement.textContent =
          "No se pudo iniciar sesión.";

      } finally {
        loginButton.disabled =
          false;


        loginButton.textContent =
          "Iniciar sesión";
      }
    }
  );
}


/* ======================================
   PROTEGER PÁGINA
====================================== */

async function protectCurrentPage() {
  if (
    document.getElementById(
      "loginForm"
    )
  ) {
    return null;
  }


  const user =
    await getAuthenticatedUser();


  if (!user) {
    clearCachedProfile();


    window.location.replace(
      "login.html"
    );


    return null;
  }


  try {
    const profile =
      await getProfile(
        user.id
      );


    cacheProfile(
      profile
    );


    if (!profile.active) {
      await supabaseClient
        .auth
        .signOut();


      clearCachedProfile();


      window.location.replace(
        "login.html"
      );


      return null;
    }


    const requiredPage =
      document.body.dataset.page;


    if (
      requiredPage === "admin" &&
      profile.role !== "admin"
    ) {
      window.location.replace(
        "vendedores.html"
      );


      return null;
    }


    return {
      user,
      profile
    };

  } catch (error) {
    console.error(
      "Error protegiendo página:",
      error
    );


    await supabaseClient
      .auth
      .signOut();


    clearCachedProfile();


    window.location.replace(
      "login.html"
    );


    return null;
  }
}


/* ======================================
   LOGOUT
====================================== */

async function logout() {
  try {
    await supabaseClient
      .auth
      .signOut();

  } catch (error) {
    console.error(
      "Error cerrando sesión:",
      error
    );

  } finally {
    clearCachedProfile();


    window.location.href =
      "login.html";
  }
}


/* ======================================
   INTERFAZ POR ROL
====================================== */

function configureUserInterface(profile) {
  document
    .querySelectorAll(
      "[data-current-user]"
    )
    .forEach(
      (element) => {
        element.textContent =
          profile.full_name;
      }
    );


  document
    .querySelectorAll(
      "[data-current-role]"
    )
    .forEach(
      (element) => {
        element.textContent =
          profile.role === "admin"
            ? "Administrador"
            : "Vendedor";
      }
    );


  if (
    profile.role !== "admin"
  ) {
    document
      .querySelectorAll(
        ".admin-only"
      )
      .forEach(
        (element) => {
          element.classList.add(
            "role-hidden"
          );
        }
      );
  }


  document
    .querySelectorAll(
      "[data-logout]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          logout
        );
      }
    );
}


/* ======================================
   INVENTARIO SUPABASE
====================================== */

async function loadInventoryFromSupabase() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("perfumes")
      .select(`
        id,
        name,
        brand,
        category,
        size,
        purchase_price,
        price,
        quantity,
        code,
        created_at,
        updated_at
      `);


  if (error) {
    console.error(
      "Error cargando inventario:",
      error
    );


    throw error;
  }


  /*
   * Ordenamos en JavaScript con comparación
   * natural para evitar problemas como:
   *
   * D12-1
   * D12-10
   * D12-2
   *
   * El resultado correcto será:
   *
   * D12-1
   * D12-2
   * D12-10
   */
  perfumes =
    (data || [])
      .map(
        mapPerfumeFromDatabase
      )
      .sort(
        (a, b) =>
          compareCodes(
            a.code,
            b.code
          )
      );


  return perfumes;
}


/* ======================================
   AGREGAR PERFUME
====================================== */

async function addPerfumeToSupabase(
  perfume
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("perfumes")
      .insert({
        name:
          perfume.name,

        brand:
          perfume.brand,

        category:
          perfume.category,

        size:
          perfume.size,

        purchase_price:
          perfume.purchasePrice,

        price:
          perfume.price,

        quantity:
          perfume.quantity,

        code:
          perfume.code
      })
      .select()
      .single();


  if (error) {
    throw error;
  }


  return mapPerfumeFromDatabase(
    data
  );
}


/* ======================================
   ACTUALIZAR PERFUME
====================================== */

async function updatePerfumeInSupabase(
  id,
  perfume
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("perfumes")
      .update({
        name:
          perfume.name,

        brand:
          perfume.brand,

        category:
          perfume.category,

        size:
          perfume.size,

        purchase_price:
          perfume.purchasePrice,

        price:
          perfume.price,

        quantity:
          perfume.quantity,

        code:
          perfume.code
      })
      .eq(
        "id",
        id
      )
      .select()
      .single();


  if (error) {
    throw error;
  }


  return mapPerfumeFromDatabase(
    data
  );
}


/* ======================================
   CAMBIAR STOCK
====================================== */

async function updateStockInSupabase(
  id,
  newQuantity
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("perfumes")
      .update({
        quantity:
          newQuantity
      })
      .eq(
        "id",
        id
      )
      .select()
      .single();


  if (error) {
    throw error;
  }


  return mapPerfumeFromDatabase(
    data
  );
}


/* ======================================
   ELIMINAR PERFUME
====================================== */

async function deletePerfumeFromSupabase(
  id
) {
  const {
    error
  } =
    await supabaseClient
      .from("perfumes")
      .delete()
      .eq(
        "id",
        id
      );


  if (error) {
    throw error;
  }
}


/* ======================================
   DASHBOARD
====================================== */

function updateDashboard() {
  const products =
    perfumes.length;


  const units =
    perfumes.reduce(
      (total, perfume) =>
        total +
        (
          Number(
            perfume.quantity
          ) || 0
        ),
      0
    );


  const low =
    perfumes.filter(
      (perfume) => {
        const quantity =
          Number(
            perfume.quantity
          ) || 0;


        return (
          quantity > 0 &&
          quantity <= 3
        );
      }
    ).length;


  const totalValue =
    perfumes.reduce(
      (total, perfume) =>
        total +
        (
          Number(
            perfume.price
          ) || 0
        ) *
        (
          Number(
            perfume.quantity
          ) || 0
        ),
      0
    );


  const totalCost =
    perfumes.reduce(
      (total, perfume) =>
        total +
        (
          Number(
            perfume.purchasePrice
          ) || 0
        ) *
        (
          Number(
            perfume.quantity
          ) || 0
        ),
      0
    );


  setText(
    "totalProducts",
    products
  );


  setText(
    "totalUnits",
    units
  );


  setText(
    "lowStock",
    low
  );


  setText(
    "inventoryValue",
    formatCurrency(
      totalValue
    )
  );


  setText(
    "inventoryCost",
    formatCurrency(
      totalCost
    )
  );


  setText(
    "summaryUnits",
    units
  );


  setText(
    "summaryLowStock",
    low
  );


  setText(
    "summaryValue",
    formatCurrency(
      totalValue
    )
  );


  setText(
    "summaryCost",
    formatCurrency(
      totalCost
    )
  );
}


/* ======================================
   PÁGINA INVENTARIO
====================================== */

function initializeInventoryPage() {
  const form =
    document.getElementById(
      "perfumeForm"
    );


  if (!form) {
    return;
  }


  const body =
    document.getElementById(
      "inventoryBody"
    );


  const search =
    document.getElementById(
      "searchInput"
    );


  const category =
    document.getElementById(
      "categoryFilter"
    );


  const empty =
    document.getElementById(
      "emptyMessage"
    );


  const editingId =
    document.getElementById(
      "editingId"
    );


  const submitButton =
    document.getElementById(
      "submitButton"
    );


  const cancelButton =
    document.getElementById(
      "cancelEditButton"
    );


  const exportButton =
    document.getElementById(
      "exportButton"
    );


  function stockClass(quantity) {
    if (quantity === 0) {
      return "empty";
    }


    if (quantity <= 3) {
      return "low";
    }


    return "good";
  }


  function filtered() {
    const query =
      normalizeText(
        search.value
      );


    return perfumes
      .filter(
        (perfume) => {
          const text =
            normalizeText(
              [
                perfume.name,
                perfume.brand,
                perfume.code,
                perfume.size
              ].join(" ")
            );


          return (
            text.includes(
              query
            ) &&
            (
              category.value ===
                "Todos" ||
              perfume.category ===
                category.value
            )
          );
        }
      )
      .sort(
        (a, b) =>
          compareCodes(
            a.code,
            b.code
          )
      );
  }


  function render() {
    body.innerHTML = "";


    const items =
      filtered();


    empty.style.display =
      items.length === 0
        ? "block"
        : "none";


    items.forEach(
      (perfume) => {
        const quantity =
          Number(
            perfume.quantity
          ) || 0;


        const row =
          document.createElement(
            "tr"
          );


        row.innerHTML = `
          <td>

            <div class="product-name">

              <strong>
                ${escapeHTML(
                  perfume.name
                )}
              </strong>

              <small>
                Código:
                ${escapeHTML(
                  perfume.code
                )}
              </small>

            </div>

          </td>


          <td>
            ${escapeHTML(
              perfume.brand
            )}
          </td>


          <td>
            <span class="category-badge">
              ${escapeHTML(
                perfume.category
              )}
            </span>
          </td>


          <td>
            ${escapeHTML(
              perfume.size
            )}
          </td>


          <td>

            <div class="stock-control">

              <button
                class="stock-button"
                data-action="decrease"
                data-id="${perfume.id}"
                type="button"
              >
                −
              </button>


              <span
                class="
                  stock-number
                  ${stockClass(
                    quantity
                  )}
                "
              >
                ${quantity}
              </span>


              <button
                class="stock-button"
                data-action="increase"
                data-id="${perfume.id}"
                type="button"
              >
                +
              </button>

            </div>

          </td>


          <td>
            ${formatCurrency(
              perfume.purchasePrice
            )}
          </td>


          <td>
            ${formatCurrency(
              perfume.price
            )}
          </td>


          <td>
            ${formatCurrency(
              quantity *
              perfume.price
            )}
          </td>


          <td>

            <div class="actions">

              <button
                class="action-button edit-button"
                data-action="edit"
                data-id="${perfume.id}"
                type="button"
              >
                Editar
              </button>


              <button
                class="action-button delete-button"
                data-action="delete"
                data-id="${perfume.id}"
                type="button"
              >
                ×
              </button>

            </div>

          </td>
        `;


        body.appendChild(
          row
        );
      }
    );


    updateDashboard();
  }


  function getData() {
    return {
      name:
        document
          .getElementById(
            "name"
          )
          .value
          .trim(),

      brand:
        document
          .getElementById(
            "brand"
          )
          .value
          .trim(),

      category:
        document
          .getElementById(
            "category"
          )
          .value,

      size:
        document
          .getElementById(
            "size"
          )
          .value
          .trim(),

      purchasePrice:
        Number(
          document
            .getElementById(
              "purchasePrice"
            )
            .value
        ),

      price:
        Number(
          document
            .getElementById(
              "price"
            )
            .value
        ),

      quantity:
        Number(
          document
            .getElementById(
              "quantity"
            )
            .value
        ),

      code:
        document
          .getElementById(
            "code"
          )
          .value
          .trim()
    };
  }


  function validate(data) {
    const duplicateCode =
      perfumes.some(
        (perfume) =>
          normalizeText(
            perfume.code
          ) ===
            normalizeText(
              data.code
            ) &&
          String(perfume.id) !==
            String(
              editingId.value
            )
      );


    if (duplicateCode) {
      showToast(
        "Ese código ya existe."
      );


      return false;
    }


    const duplicateProduct =
      perfumes.some(
        (perfume) =>
          normalizeText(
            perfume.name
          ) ===
            normalizeText(
              data.name
            ) &&
          normalizeText(
            perfume.brand
          ) ===
            normalizeText(
              data.brand
            ) &&
          normalizeText(
            perfume.size
          ) ===
            normalizeText(
              data.size
            ) &&
          String(perfume.id) !==
            String(
              editingId.value
            )
      );


    if (duplicateProduct) {
      showToast(
        "Ese perfume ya existe."
      );


      return false;
    }


    if (
      data.purchasePrice < 0 ||
      data.price < 0 ||
      data.quantity < 0
    ) {
      showToast(
        "Los valores no pueden ser negativos."
      );


      return false;
    }


    return true;
  }


  function resetForm() {
    form.reset();


    editingId.value = "";


    document
      .getElementById(
        "quantity"
      )
      .value = 1;


    submitButton.textContent =
      "+ Agregar perfume";


    cancelButton.classList.add(
      "hidden"
    );
  }


  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      const perfumeData =
        getData();


      if (
        !validate(
          perfumeData
        )
      ) {
        return;
      }


      submitButton.disabled =
        true;


      try {
        if (
          editingId.value
        ) {
          const updated =
            await updatePerfumeInSupabase(
              editingId.value,
              perfumeData
            );


          const index =
            perfumes.findIndex(
              (item) =>
                String(item.id) ===
                String(updated.id)
            );


          if (index !== -1) {
            perfumes[index] =
              updated;
          }


          perfumes =
            sortPerfumesByCode(
              perfumes
            );


          showToast(
            "Perfume actualizado."
          );

        } else {
          const created =
            await addPerfumeToSupabase(
              perfumeData
            );


          perfumes.push(
            created
          );


          perfumes =
            sortPerfumesByCode(
              perfumes
            );


          showToast(
            "Perfume agregado."
          );
        }


        resetForm();


        render();

      } catch (error) {
        console.error(
          error
        );


        if (
          error.code ===
          "23505"
        ) {
          showToast(
            "Ese perfume o código ya existe."
          );

        } else {
          showToast(
            "No se pudo guardar el perfume."
          );
        }

      } finally {
        submitButton.disabled =
          false;
      }
    }
  );


  cancelButton.addEventListener(
    "click",
    resetForm
  );


  body.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "[data-action]"
        );


      if (!button) {
        return;
      }


      const perfume =
        perfumes.find(
          (item) =>
            String(item.id) ===
            String(
              button.dataset.id
            )
        );


      if (!perfume) {
        return;
      }


      const action =
        button.dataset.action;


      if (
        action === "increase" ||
        action === "decrease"
      ) {
        const currentQuantity =
          Number(
            perfume.quantity
          ) || 0;


        const newQuantity =
          action === "increase"
            ? currentQuantity + 1
            : currentQuantity - 1;


        if (newQuantity < 0) {
          return;
        }


        try {
          const updated =
            await updateStockInSupabase(
              perfume.id,
              newQuantity
            );


          perfume.quantity =
            updated.quantity;


          render();

        } catch (error) {
          console.error(
            error
          );


          showToast(
            "No se pudo actualizar el stock."
          );
        }


        return;
      }


      if (
        action === "delete"
      ) {
        const confirmed =
          window.confirm(
            `¿Eliminar "${perfume.name}"?`
          );


        if (!confirmed) {
          return;
        }


        try {
          await deletePerfumeFromSupabase(
            perfume.id
          );


          perfumes =
            perfumes.filter(
              (item) =>
                item.id !==
                perfume.id
            );


          render();


          showToast(
            "Perfume eliminado."
          );

        } catch (error) {
          console.error(
            error
          );


          showToast(
            "No se pudo eliminar el perfume."
          );
        }


        return;
      }


      if (
        action === "edit"
      ) {
        editingId.value =
          perfume.id;


        document
          .getElementById(
            "name"
          )
          .value =
            perfume.name;


        document
          .getElementById(
            "brand"
          )
          .value =
            perfume.brand;


        document
          .getElementById(
            "category"
          )
          .value =
            perfume.category;


        document
          .getElementById(
            "size"
          )
          .value =
            perfume.size;


        document
          .getElementById(
            "purchasePrice"
          )
          .value =
            perfume.purchasePrice;


        document
          .getElementById(
            "price"
          )
          .value =
            perfume.price;


        document
          .getElementById(
            "quantity"
          )
          .value =
            perfume.quantity;


        document
          .getElementById(
            "code"
          )
          .value =
            perfume.code;


        submitButton.textContent =
          "Guardar cambios";


        cancelButton.classList.remove(
          "hidden"
        );


        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }
  );


  search.addEventListener(
    "input",
    render
  );


  category.addEventListener(
    "change",
    render
  );


  exportButton.addEventListener(
    "click",
    () => {
      if (
        perfumes.length === 0
      ) {
        showToast(
          "No hay productos para exportar."
        );


        return;
      }


      const orderedPerfumes =
        sortPerfumesByCode(
          perfumes
        );


      const rows = [
        [
          "Código",
          "Nombre",
          "Marca",
          "Categoría",
          "Tamaño",
          "Cantidad",
          "Compra",
          "Venta"
        ],

        ...orderedPerfumes.map(
          (perfume) => [
            perfume.code,
            perfume.name,
            perfume.brand,
            perfume.category,
            perfume.size,
            perfume.quantity,
            perfume.purchasePrice,
            perfume.price
          ]
        )
      ];


      const csv =
        rows
          .map(
            (row) =>
              row
                .map(
                  (value) =>
                    `"${String(
                      value
                    ).replaceAll(
                      '"',
                      '""'
                    )}"`
                )
                .join(",")
          )
          .join("\n");


      const blob =
        new Blob(
          [
            "\uFEFF" +
            csv
          ],
          {
            type:
              "text/csv;charset=utf-8"
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        url;


      link.download =
        "inventario-duvant12.csv";


      link.click();


      URL.revokeObjectURL(
        url
      );
    }
  );


  initializeExcelImport(
    render
  );


  render();
}


/* ======================================
   EXCEL
====================================== */

function initializeExcelImport(
  renderInventory
) {
  const downloadButton =
    document.getElementById(
      "downloadExcelTemplateButton"
    );


  const importButton =
    document.getElementById(
      "importExcelButton"
    );


  const fileInput =
    document.getElementById(
      "excelFileInput"
    );


  const modal =
    document.getElementById(
      "excelImportModal"
    );


  const previewBody =
    document.getElementById(
      "excelPreviewBody"
    );


  const summary =
    document.getElementById(
      "excelImportSummary"
    );


  const confirmButton =
    document.getElementById(
      "confirmExcelImportButton"
    );


  if (
    !downloadButton ||
    !importButton ||
    !fileInput ||
    !modal ||
    !previewBody ||
    !summary ||
    !confirmButton
  ) {
    return;
  }


  /* ====================================
     DESCARGAR PLANTILLA
     CON INVENTARIO ACTUAL ORDENADO
  ==================================== */

  downloadButton.addEventListener(
    "click",
    () => {
      if (
        typeof XLSX ===
        "undefined"
      ) {
        showToast(
          "No se pudo cargar la librería de Excel."
        );

        return;
      }


      const orderedPerfumes =
        sortPerfumesByCode(
          perfumes
        );


      /*
       * IMPORTANTE:
       *
       * Esta plantilla NO contiene:
       * - precio de compra
       * - precio de venta
       * - margen
       * - costo total
       *
       * Solo contiene información
       * que puedes enviar al distribuidor.
       */
      const rows = [
        [
          "Código",
          "Nombre",
          "Marca",
          "Categoría",
          "Tamaño",
          "Cantidad"
        ],

        ...orderedPerfumes.map(
          (perfume) => [
            perfume.code,
            perfume.name,
            perfume.brand,
            perfume.category,
            perfume.size,
            perfume.quantity
          ]
        )
      ];


      const worksheet =
        XLSX.utils.aoa_to_sheet(
          rows
        );


      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 30 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 12 }
      ];


      const workbook =
        XLSX.utils.book_new();


      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Pedido"
      );


      const today =
        new Date()
          .toISOString()
          .slice(0, 10);


      XLSX.writeFile(
        workbook,
        `pedido-duvant12-${today}.xlsx`
      );


      showToast(
        `${orderedPerfumes.length} productos incluidos en la plantilla.`
      );
    }
  );


  /* ====================================
     ABRIR SELECTOR
  ==================================== */

  importButton.addEventListener(
    "click",
    () => {
      fileInput.value = "";

      fileInput.click();
    }
  );


  /* ====================================
     CERRAR MODAL
  ==================================== */

  function closeModal() {
    modal.classList.add(
      "hidden"
    );


    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.classList.remove(
      "modal-open"
    );


    excelImportRows = [];
  }


  document
    .querySelectorAll(
      "[data-close-excel-modal]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          closeModal
        );
      }
    );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !modal.classList.contains(
          "hidden"
        )
      ) {
        closeModal();
      }
    }
  );


  /* ====================================
     NORMALIZAR CABECERAS
  ==================================== */

  function normalizeHeader(value) {
    return normalizeForComparison(
      value
    )
      .replace(/\s+/g, "")
      .replace(
        /[^a-z0-9]/g,
        ""
      );
  }


  /* ====================================
     CATEGORÍA
  ==================================== */

  function normalizeCategory(value) {
    const normalizedCategory =
      normalizeForComparison(
        value
      );


    if (
      normalizedCategory ===
      "hombre"
    ) {
      return "Hombre";
    }


    if (
      normalizedCategory ===
      "mujer"
    ) {
      return "Mujer";
    }


    if (
      normalizedCategory ===
      "unisex"
    ) {
      return "Unisex";
    }


    return "";
  }


  /* ====================================
     BUSCAR PRODUCTO EXISTENTE
  ==================================== */

  function analyzeExistingProduct(row) {
    const byCode =
      perfumes.find(
        (perfume) =>
          normalizeForComparison(
            perfume.code
          ) ===
          normalizeForComparison(
            row.code
          )
      );


    const byIdentity =
      perfumes.find(
        (perfume) =>
          normalizeForComparison(
            perfume.name
          ) ===
            normalizeForComparison(
              row.name
            ) &&
          normalizeForComparison(
            perfume.brand
          ) ===
            normalizeForComparison(
              row.brand
            ) &&
          normalizeForComparison(
            perfume.size
          ) ===
            normalizeForComparison(
              row.size
            )
      );


    if (
      byCode &&
      byIdentity &&
      byCode.id !==
        byIdentity.id
    ) {
      return {
        type: "conflict",

        message:
          "El código y el producto corresponden a registros diferentes."
      };
    }


    if (
      byCode &&
      !byIdentity
    ) {
      return {
        type: "conflict",

        message:
          "Ese código ya pertenece a otro perfume."
      };
    }


    if (
      !byCode &&
      byIdentity
    ) {
      return {
        type: "conflict",

        message:
          `Ese perfume ya existe con el código ${byIdentity.code}.`
      };
    }


    if (
      byCode &&
      byIdentity
    ) {
      return {
        type: "existing",

        perfume:
          byCode
      };
    }


    return {
      type: "new",

      perfume: null
    };
  }


  /* ====================================
     LEER ARCHIVO
  ==================================== */

  fileInput.addEventListener(
    "change",
    async () => {
      const file =
        fileInput.files?.[0];


      if (!file) {
        return;
      }


      if (
        typeof XLSX ===
        "undefined"
      ) {
        showToast(
          "No se pudo cargar la librería de Excel."
        );

        return;
      }


      try {
        const buffer =
          await file.arrayBuffer();


        const workbook =
          XLSX.read(
            buffer,
            {
              type: "array"
            }
          );


        const sheetName =
          workbook.SheetNames[0];


        if (!sheetName) {
          throw new Error(
            "El archivo no contiene hojas."
          );
        }


        const worksheet =
          workbook.Sheets[
            sheetName
          ];


        const matrix =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              header: 1,
              defval: "",
              raw: false
            }
          );


        if (
          matrix.length < 2
        ) {
          showToast(
            "El Excel no contiene productos."
          );

          return;
        }


        const headers =
          matrix[0].map(
            normalizeHeader
          );


        const requiredHeaders = {
          codigo: "Código",
          nombre: "Nombre",
          marca: "Marca",
          categoria: "Categoría",
          tamano: "Tamaño",
          cantidad: "Cantidad"
        };


        const indexes = {};


        for (
          const [
            key,
            label
          ] of Object.entries(
            requiredHeaders
          )
        ) {
          const index =
            headers.indexOf(
              key
            );


          if (index === -1) {
            showToast(
              `Falta la columna "${label}".`
            );

            return;
          }


          indexes[key] =
            index;
        }


        const parsedRows = [];

        const seenCodes =
          new Set();

        const seenProducts =
          new Set();


        matrix
          .slice(1)
          .forEach(
            (
              values,
              arrayIndex
            ) => {
              const excelRow =
                arrayIndex + 2;


              const code =
                String(
                  values[
                    indexes.codigo
                  ] ?? ""
                ).trim();


              const name =
                String(
                  values[
                    indexes.nombre
                  ] ?? ""
                ).trim();


              const brand =
                String(
                  values[
                    indexes.marca
                  ] ?? ""
                ).trim();


              const rawCategory =
                String(
                  values[
                    indexes.categoria
                  ] ?? ""
                ).trim();


              const size =
                String(
                  values[
                    indexes.tamano
                  ] ?? ""
                ).trim();


              const rawQuantity =
                String(
                  values[
                    indexes.cantidad
                  ] ?? ""
                )
                  .trim()
                  .replace(
                    ",",
                    "."
                  );


              if (
                !code &&
                !name &&
                !brand &&
                !rawCategory &&
                !size &&
                !rawQuantity
              ) {
                return;
              }


              const normalizedCategory =
                normalizeCategory(
                  rawCategory
                );


              const quantity =
                Number(
                  rawQuantity
                );


              const row = {
                rowNumber:
                  excelRow,

                code,

                name,

                brand,

                category:
                  normalizedCategory,

                rawCategory,

                size,

                quantity,

                purchasePrice:
                  null,

                salePrice:
                  null,

                action:
                  "new",

                existing:
                  null,

                status:
                  "valid",

                error:
                  ""
              };


              if (
                !code ||
                !name ||
                !brand ||
                !rawCategory ||
                !size ||
                !rawQuantity
              ) {
                row.status =
                  "error";

                row.error =
                  "Hay campos obligatorios vacíos.";


                parsedRows.push(
                  row
                );


                return;
              }


              if (
                !normalizedCategory
              ) {
                row.status =
                  "error";

                row.error =
                  "Categoría inválida. Usa Hombre, Mujer o Unisex.";


                parsedRows.push(
                  row
                );


                return;
              }


              if (
                !Number.isInteger(
                  quantity
                ) ||
                quantity <= 0
              ) {
                row.status =
                  "error";

                row.error =
                  "Cantidad debe ser un número entero mayor que 0.";


                parsedRows.push(
                  row
                );


                return;
              }


              const codeKey =
                normalizeForComparison(
                  code
                );


              const productKey =
                [
                  normalizeForComparison(
                    name
                  ),

                  normalizeForComparison(
                    brand
                  ),

                  normalizeForComparison(
                    size
                  )
                ].join("|");


              if (
                seenCodes.has(
                  codeKey
                )
              ) {
                row.status =
                  "error";

                row.error =
                  "Código repetido dentro del Excel.";


                parsedRows.push(
                  row
                );


                return;
              }


              if (
                seenProducts.has(
                  productKey
                )
              ) {
                row.status =
                  "error";

                row.error =
                  "Perfume repetido dentro del Excel.";


                parsedRows.push(
                  row
                );


                return;
              }


              seenCodes.add(
                codeKey
              );


              seenProducts.add(
                productKey
              );


              const analysis =
                analyzeExistingProduct(
                  row
                );


              if (
                analysis.type ===
                "conflict"
              ) {
                row.status =
                  "error";

                row.error =
                  analysis.message;


                parsedRows.push(
                  row
                );


                return;
              }


              if (
                analysis.type ===
                "existing"
              ) {
                row.status =
                  "existing";

                row.action =
                  "restock";

                row.existing =
                  analysis.perfume;


                row.purchasePrice =
                  analysis.perfume
                    .purchasePrice;


                row.salePrice =
                  analysis.perfume
                    .price;
              }


              parsedRows.push(
                row
              );
            }
          );


        /*
         * También ordenamos la vista previa
         * del Excel por código.
         */
        excelImportRows =
          parsedRows.sort(
            (a, b) =>
              compareCodes(
                a.code,
                b.code
              )
          );


        renderExcelPreview();


        modal.classList.remove(
          "hidden"
        );


        modal.setAttribute(
          "aria-hidden",
          "false"
        );


        document.body.classList.add(
          "modal-open"
        );

      } catch (error) {
        console.error(
          "Error leyendo Excel:",
          error
        );


        showToast(
          "No se pudo leer el archivo Excel."
        );
      }
    }
  );


  /* ====================================
     RENDER VISTA PREVIA
  ==================================== */

  function renderExcelPreview() {
    previewBody.innerHTML = "";


    const validCount =
      excelImportRows.filter(
        (row) =>
          row.status === "valid"
      ).length;


    const existingCount =
      excelImportRows.filter(
        (row) =>
          row.status === "existing"
      ).length;


    const errorCount =
      excelImportRows.filter(
        (row) =>
          row.status === "error"
      ).length;


    summary.innerHTML = `
      <article class="excel-summary-item">

        <span>
          Productos detectados
        </span>

        <strong>
          ${excelImportRows.length}
        </strong>

      </article>


      <article class="excel-summary-item excel-summary-new">

        <span>
          Nuevos
        </span>

        <strong>
          ${validCount}
        </strong>

      </article>


      <article class="excel-summary-item excel-summary-existing">

        <span>
          Ya existentes
        </span>

        <strong>
          ${existingCount}
        </strong>

      </article>


      <article class="excel-summary-item excel-summary-error">

        <span>
          Con errores
        </span>

        <strong>
          ${errorCount}
        </strong>

      </article>
    `;


    excelImportRows.forEach(
      (row, index) => {
        const tr =
          document.createElement(
            "tr"
          );


        if (
          row.status ===
          "error"
        ) {
          tr.classList.add(
            "excel-row-error"
          );
        }


        let statusHTML = "";
        let actionHTML = "";
        let purchaseHTML = "";
        let saleHTML = "";


        if (
          row.status === "error"
        ) {
          statusHTML = `
            <span class="excel-status excel-status-error">
              Error
            </span>

            <small class="excel-row-message">
              ${escapeHTML(
                row.error
              )}
            </small>
          `;


          actionHTML =
            "No disponible";


          purchaseHTML = "—";
          saleHTML = "—";

        } else if (
          row.status ===
          "existing"
        ) {
          statusHTML = `
            <span class="excel-status excel-status-existing">
              Ya existe
            </span>

            <small class="excel-row-message">
              Stock actual: ${row.existing.quantity}
            </small>
          `;


          actionHTML = `
            <select
              class="excel-action-select"
              data-excel-action="${index}"
            >
              <option
                value="restock"
                ${
                  row.action ===
                    "restock"
                    ? "selected"
                    : ""
                }
              >
                Sumar al stock
              </option>

              <option
                value="skip"
                ${
                  row.action ===
                    "skip"
                    ? "selected"
                    : ""
                }
              >
                Omitir
              </option>
            </select>
          `;


          purchaseHTML = `
            <input
              class="excel-price-input"
              data-excel-purchase="${index}"
              type="number"
              min="0"
              step="0.01"
              value="${row.purchasePrice ?? ""}"
              ${
                row.action ===
                  "skip"
                  ? "disabled"
                  : ""
              }
            >
          `;


          saleHTML = `
            <input
              class="excel-price-input"
              data-excel-sale="${index}"
              type="number"
              min="0"
              step="0.01"
              value="${row.salePrice ?? ""}"
              ${
                row.action ===
                  "skip"
                  ? "disabled"
                  : ""
              }
            >
          `;

        } else {
          statusHTML = `
            <span class="excel-status excel-status-new">
              Nuevo
            </span>
          `;


          actionHTML = `
            <span class="excel-fixed-action">
              Agregar
            </span>
          `;


          purchaseHTML = `
            <input
              class="excel-price-input"
              data-excel-purchase="${index}"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value="${row.purchasePrice ?? ""}"
            >
          `;


          saleHTML = `
            <input
              class="excel-price-input"
              data-excel-sale="${index}"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value="${row.salePrice ?? ""}"
            >
          `;
        }


        tr.innerHTML = `
          <td>
            ${row.rowNumber}
          </td>


          <td>

            <div class="excel-product-cell">

              <strong>
                ${escapeHTML(
                  row.name
                )}
              </strong>

              <span>
                ${escapeHTML(
                  row.brand
                )}
                ·
                ${escapeHTML(
                  row.size
                )}
              </span>

              <small>
                ${escapeHTML(
                  row.code
                )}
                ·
                ${escapeHTML(
                  row.category ||
                  row.rawCategory
                )}
              </small>

            </div>

          </td>


          <td>
            <strong>
              ${
                Number.isFinite(
                  row.quantity
                )
                  ? row.quantity
                  : "—"
              }
            </strong>
          </td>


          <td>
            ${statusHTML}
          </td>


          <td>
            ${actionHTML}
          </td>


          <td>
            ${purchaseHTML}
          </td>


          <td>
            ${saleHTML}
          </td>
        `;


        previewBody.appendChild(
          tr
        );
      }
    );


    updateConfirmButton();
  }


  /* ====================================
     CAMBIAR ACCIÓN
  ==================================== */

  previewBody.addEventListener(
    "change",
    (event) => {
      const actionSelect =
        event.target.closest(
          "[data-excel-action]"
        );


      if (actionSelect) {
        const index =
          Number(
            actionSelect.dataset
              .excelAction
          );


        excelImportRows[
          index
        ].action =
          actionSelect.value;


        renderExcelPreview();


        return;
      }


      const purchaseInput =
        event.target.closest(
          "[data-excel-purchase]"
        );


      if (purchaseInput) {
        const index =
          Number(
            purchaseInput.dataset
              .excelPurchase
          );


        excelImportRows[
          index
        ].purchasePrice =
          purchaseInput.value === ""
            ? null
            : Number(
                purchaseInput.value
              );


        updateConfirmButton();


        return;
      }


      const saleInput =
        event.target.closest(
          "[data-excel-sale]"
        );


      if (saleInput) {
        const index =
          Number(
            saleInput.dataset
              .excelSale
          );


        excelImportRows[
          index
        ].salePrice =
          saleInput.value === ""
            ? null
            : Number(
                saleInput.value
              );


        updateConfirmButton();
      }
    }
  );


  previewBody.addEventListener(
    "input",
    (event) => {
      const purchaseInput =
        event.target.closest(
          "[data-excel-purchase]"
        );


      if (purchaseInput) {
        const index =
          Number(
            purchaseInput.dataset
              .excelPurchase
          );


        excelImportRows[
          index
        ].purchasePrice =
          purchaseInput.value === ""
            ? null
            : Number(
                purchaseInput.value
              );


        updateConfirmButton();
      }


      const saleInput =
        event.target.closest(
          "[data-excel-sale]"
        );


      if (saleInput) {
        const index =
          Number(
            saleInput.dataset
              .excelSale
          );


        excelImportRows[
          index
        ].salePrice =
          saleInput.value === ""
            ? null
            : Number(
                saleInput.value
              );


        updateConfirmButton();
      }
    }
  );


  /* ====================================
     VALIDAR PRECIOS
  ==================================== */

  function rowHasValidPrices(row) {
    if (
      row.status === "error" ||
      row.action === "skip"
    ) {
      return true;
    }


    return (
      Number.isFinite(
        row.purchasePrice
      ) &&
      row.purchasePrice >= 0 &&
      Number.isFinite(
        row.salePrice
      ) &&
      row.salePrice >= 0
    );
  }


  function rowsToImport() {
    return excelImportRows.filter(
      (row) =>
        row.status !== "error" &&
        row.action !== "skip"
    );
  }


  function updateConfirmButton() {
    const rows =
      rowsToImport();


    const allPricesValid =
      rows.every(
        rowHasValidPrices
      );


    confirmButton.disabled =
      rows.length === 0 ||
      !allPricesValid;


    confirmButton.textContent =
      rows.length > 0
        ? `Importar ${rows.length} ${
            rows.length === 1
              ? "producto"
              : "productos"
          }`
        : "Nada para importar";
  }


  /* ====================================
     CONFIRMAR IMPORTACIÓN
  ==================================== */

  confirmButton.addEventListener(
    "click",
    async () => {
      const rows =
        rowsToImport();


      if (
        rows.length === 0
      ) {
        return;
      }


      if (
        !rows.every(
          rowHasValidPrices
        )
      ) {
        showToast(
          "Completa todos los precios antes de importar."
        );

        return;
      }


      const confirmed =
        window.confirm(
          `¿Importar ${rows.length} ${
            rows.length === 1
              ? "producto"
              : "productos"
          } al inventario?`
        );


      if (!confirmed) {
        return;
      }


      confirmButton.disabled =
        true;


      confirmButton.textContent =
        "Importando...";


      let successCount = 0;
      let errorCount = 0;


      for (
        const row of rows
      ) {
        try {
          if (
            row.status ===
              "existing" &&
            row.action ===
              "restock"
          ) {
            const existing =
              row.existing;


            const currentQuantity =
              Number(
                existing.quantity
              ) || 0;


            const incomingQuantity =
              Number(
                row.quantity
              ) || 0;


            const totalQuantity =
              currentQuantity +
              incomingQuantity;


            const currentValue =
              currentQuantity *
              (
                Number(
                  existing.purchasePrice
                ) || 0
              );


            const incomingValue =
              incomingQuantity *
              row.purchasePrice;


            const averagePurchasePrice =
              totalQuantity > 0
                ? roundMoney(
                    (
                      currentValue +
                      incomingValue
                    ) /
                    totalQuantity
                  )
                : row.purchasePrice;


            const updated =
              await updatePerfumeInSupabase(
                existing.id,
                {
                  name:
                    existing.name,

                  brand:
                    existing.brand,

                  category:
                    existing.category,

                  size:
                    existing.size,

                  purchasePrice:
                    averagePurchasePrice,

                  price:
                    row.salePrice,

                  quantity:
                    totalQuantity,

                  code:
                    existing.code
                }
              );


            const index =
              perfumes.findIndex(
                (item) =>
                  item.id ===
                  updated.id
              );


            if (
              index !== -1
            ) {
              perfumes[
                index
              ] = updated;
            }


            successCount++;


            continue;
          }


          if (
            row.status === "valid"
          ) {
            const created =
              await addPerfumeToSupabase({
                name:
                  row.name,

                brand:
                  row.brand,

                category:
                  row.category,

                size:
                  row.size,

                purchasePrice:
                  row.purchasePrice,

                price:
                  row.salePrice,

                quantity:
                  row.quantity,

                code:
                  row.code
              });


            perfumes.push(
              created
            );


            successCount++;
          }

        } catch (error) {
          console.error(
            `Error importando fila ${row.rowNumber}:`,
            error
          );


          errorCount++;
        }
      }


      try {
        /*
         * Recargamos desde Supabase.
         *
         * loadInventoryFromSupabase()
         * ya ordena automáticamente
         * por código.
         */
        await loadInventoryFromSupabase();


        renderInventory();

      } catch (error) {
        console.error(
          "Error recargando inventario:",
          error
        );
      }


      closeModal();


      if (
        errorCount === 0
      ) {
        showToast(
          `${successCount} ${
            successCount === 1
              ? "producto importado"
              : "productos importados"
          } correctamente.`
        );

      } else {
        showToast(
          `${successCount} importados y ${errorCount} con error.`
        );
      }
    }
  );
}


/* ======================================
   VENDEDORES - SUPABASE
====================================== */

async function loadSellerCatalog() {
  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "get_seller_catalog"
      );


  if (error) {
    console.error(
      "Error cargando catálogo:",
      error
    );


    throw error;
  }


  sellerCatalog =
    (data || [])
      .map(
        (perfume) => ({
          id:
            perfume.id,

          name:
            perfume.name,

          brand:
            perfume.brand,

          category:
            perfume.category,

          size:
            perfume.size,

          price:
            Number(
              perfume.price
            ) || 0,

          code:
            perfume.code,

          availability:
            perfume.availability
        })
      )
      .sort(
        (a, b) =>
          compareCodes(
            a.code,
            b.code
          )
      );


  return sellerCatalog;
}


/* ======================================
   REGISTRAR VENTA
====================================== */

async function registerSellerSale(
  perfumeId
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "register_sale",
        {
          p_perfume_id:
            perfumeId
        }
      );


  if (error) {
    throw error;
  }


  return data;
}


/* ======================================
   PÁGINA VENDEDORES
====================================== */

function initializeSellerPage() {
  const grid =
    document.getElementById(
      "sellerProductsGrid"
    );


  if (!grid) {
    return;
  }


  const search =
    document.getElementById(
      "sellerSearchInput"
    );


  const category =
    document.getElementById(
      "sellerCategoryFilter"
    );


  const availabilityFilter =
    document.getElementById(
      "sellerAvailabilityFilter"
    );


  const empty =
    document.getElementById(
      "sellerEmptyState"
    );


  function availabilityClass(state) {
    if (
      state === "Agotado"
    ) {
      return "availability-out";
    }


    if (
      state === "Unidad única"
    ) {
      return "availability-last";
    }


    if (
      state === "Pocas unidades"
    ) {
      return "availability-low";
    }


    return "availability-available";
  }


  function filtered() {
    const query =
      normalizeText(
        search?.value || ""
      );


    return sellerCatalog
      .filter(
        (perfume) => {
          const text =
            normalizeText(
              [
                perfume.name,
                perfume.brand,
                perfume.code,
                perfume.size
              ].join(" ")
            );


          return (
            text.includes(
              query
            ) &&
            (
              !category ||
              category.value ===
                "Todos" ||
              perfume.category ===
                category.value
            ) &&
            (
              !availabilityFilter ||
              availabilityFilter.value ===
                "Todos" ||
              perfume.availability ===
                availabilityFilter.value
            )
          );
        }
      )
      .sort(
        (a, b) =>
          compareCodes(
            a.code,
            b.code
          )
      );
  }


  function render() {
    grid.innerHTML = "";


    const items =
      filtered();


    if (empty) {
      empty.style.display =
        items.length === 0
          ? "block"
          : "none";
    }


    items.forEach(
      (perfume) => {
        const soldOut =
          perfume.availability ===
          "Agotado";


        const card =
          document.createElement(
            "article"
          );


        card.className =
          "seller-product-card";


        if (soldOut) {
          card.classList.add(
            "sold-out"
          );
        }


        card.innerHTML = `
          <div class="seller-card-top">

            <span class="seller-brand">
              ${escapeHTML(
                perfume.brand
              )}
            </span>

            <span class="seller-category">
              ${escapeHTML(
                perfume.category
              )}
            </span>

          </div>


          <div class="seller-card-body">

            <h3>
              ${escapeHTML(
                perfume.name
              )}
            </h3>


            <div class="seller-product-meta">

              <span>
                ${escapeHTML(
                  perfume.size
                )}
              </span>

              <span>
                •
              </span>

              <span>
                ${escapeHTML(
                  perfume.code
                )}
              </span>

            </div>


            <strong class="seller-product-price">
              ${formatCurrency(
                perfume.price
              )}
            </strong>


            <span
              class="
                availability-status
                ${availabilityClass(
                  perfume.availability
                )}
              "
            >
              ${escapeHTML(
                perfume.availability
              )}
            </span>


            <div class="seller-sale-action">

              <button
                class="seller-sale-button"
                data-sale-id="${perfume.id}"
                type="button"
                ${soldOut ? "disabled" : ""}
              >
                ${
                  soldOut
                    ? "Producto agotado"
                    : "Registrar venta"
                }
              </button>

            </div>

          </div>
        `;


        grid.appendChild(
          card
        );
      }
    );
  }


  grid.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "[data-sale-id]"
        );


      if (!button) {
        return;
      }


      const perfume =
        sellerCatalog.find(
          (item) =>
            String(item.id) ===
            String(
              button.dataset.saleId
            )
        );


      if (
        !perfume ||
        perfume.availability ===
          "Agotado"
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          `¿Registrar venta de "${perfume.name}" por ${formatCurrency(
            perfume.price
          )}?`
        );


      if (!confirmed) {
        return;
      }


      button.disabled =
        true;


      button.textContent =
        "Registrando...";


      try {
        await registerSellerSale(
          perfume.id
        );


        await loadSellerCatalog();


        render();


        showToast(
          `Venta registrada: ${perfume.name}`
        );

      } catch (error) {
        console.error(
          "Error registrando venta:",
          error
        );


        showToast(
          error.message
            ?.toLowerCase()
            .includes(
              "agotado"
            )
            ? "El perfume ya está agotado."
            : "No se pudo registrar la venta."
        );


        try {
          await loadSellerCatalog();

          render();

        } catch (
          refreshError
        ) {
          console.error(
            refreshError
          );
        }
      }
    }
  );


  search?.addEventListener(
    "input",
    render
  );


  category?.addEventListener(
    "change",
    render
  );


  availabilityFilter
    ?.addEventListener(
      "change",
      render
    );


  async function load() {
    try {
      await loadSellerCatalog();


      render();

    } catch (error) {
      console.error(
        error
      );


      if (empty) {
        empty.style.display =
          "block";


        const title =
          empty.querySelector(
            "h3"
          );


        const paragraph =
          empty.querySelector(
            "p"
          );


        if (title) {
          title.textContent =
            "No se pudo cargar el catálogo";
        }


        if (paragraph) {
          paragraph.textContent =
            "Verifica tu conexión e intenta nuevamente.";
        }
      }
    }
  }


  load();
}


/* ======================================
   USUARIOS
====================================== */

function initializeUsersPage() {
  const form =
    document.getElementById(
      "sellerUserForm"
    );


  if (!form) {
    return;
  }


  const generateButton =
    document.getElementById(
      "generateCredentialsButton"
    );


  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );


  if (generateButton) {
    generateButton.disabled =
      true;
  }


  if (submitButton) {
    submitButton.disabled =
      true;
  }
}


/* ======================================
   APP
====================================== */

async function initializeApp() {
  if (
    document.getElementById(
      "loginForm"
    )
  ) {
    await initializeLoginPage();

    return;
  }


  const auth =
    await protectCurrentPage();


  if (!auth) {
    return;
  }


  configureUserInterface(
    auth.profile
  );


  const isDashboard =
    Boolean(
      document.getElementById(
        "totalProducts"
      )
    );


  const isInventory =
    Boolean(
      document.getElementById(
        "perfumeForm"
      )
    );


  const isSellerPage =
    Boolean(
      document.getElementById(
        "sellerProductsGrid"
      )
    );


  const isUsersPage =
    Boolean(
      document.getElementById(
        "sellerUserForm"
      )
    );


  if (
    (
      isDashboard ||
      isInventory
    ) &&
    auth.profile.role ===
      "admin"
  ) {
    try {
      await loadInventoryFromSupabase();

    } catch (error) {
      console.error(
        "No se pudo cargar el inventario:",
        error
      );


      showToast(
        "No se pudo cargar el inventario."
      );
    }
  }


  if (isDashboard) {
    updateDashboard();
  }


  if (
    isInventory &&
    auth.profile.role ===
      "admin"
  ) {
    initializeInventoryPage();
  }


  if (isSellerPage) {
    initializeSellerPage();
  }


  if (
    isUsersPage &&
    auth.profile.role ===
      "admin"
  ) {
    initializeUsersPage();
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);