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
  const { data, error } = await supabaseClient.rpc(
    "get_seller_catalog"
  );

  if (error) {
    console.error(
      "Error cargando catálogo:",
      error
    );

    throw error;
  }

  sellerCatalog = (data || [])
    .map((perfume) => ({
      id: perfume.id,
      name: perfume.name,
      brand: perfume.brand,
      category: perfume.category,
      size: perfume.size,
      price: Number(perfume.price) || 0,
      code: perfume.code,
      availability: perfume.availability
    }))
    .sort((a, b) =>
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
  const { data, error } =
    await supabaseClient.rpc(
      "register_sale",
      {
        p_perfume_id: perfumeId
      }
    );

  if (error) {
    console.error(
      "Error RPC register_sale:",
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }
    );

    throw new Error(
      error.message ||
      error.details ||
      "No se pudo registrar la venta."
    );
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

  const modal =
    document.getElementById(
      "saleConfirmationModal"
    );

  const modalBrand =
    document.getElementById(
      "saleModalBrand"
    );

  const modalName =
    document.getElementById(
      "saleModalName"
    );

  const modalSize =
    document.getElementById(
      "saleModalSize"
    );

  const modalCode =
    document.getElementById(
      "saleModalCode"
    );

  const modalPrice =
    document.getElementById(
      "saleModalPrice"
    );

  const cancelButton =
    document.getElementById(
      "cancelSaleButton"
    );

  const confirmButton =
    document.getElementById(
      "confirmSaleButton"
    );

  let selectedPerfume = null;
  let registeringSale = false;


  /* ====================================
     DISPONIBILIDAD
  ==================================== */

  function availabilityClass(
    state
  ) {
    if (state === "Agotado") {
      return "availability-out";
    }

    if (
      state ===
      "Unidad única"
    ) {
      return "availability-last";
    }

    if (
      state ===
      "Pocas unidades"
    ) {
      return "availability-low";
    }

    return "availability-available";
  }


  /* ====================================
     FILTRAR
  ==================================== */

  function filtered() {
    const query =
      normalizeText(
        search?.value || ""
      );

    return sellerCatalog
      .filter((perfume) => {
        const text =
          normalizeText(
            [
              perfume.name,
              perfume.brand,
              perfume.code,
              perfume.size
            ].join(" ")
          );

        const matchesSearch =
          text.includes(query);

        const matchesCategory =
          !category ||
          category.value ===
            "Todos" ||
          perfume.category ===
            category.value;

        const matchesAvailability =
          !availabilityFilter ||
          availabilityFilter.value ===
            "Todos" ||
          perfume.availability ===
            availabilityFilter.value;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesAvailability
        );
      })
      .sort((a, b) =>
        compareCodes(
          a.code,
          b.code
        )
      );
  }


  /* ====================================
     RENDER CATÁLOGO
  ==================================== */

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

              <span>•</span>

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
                data-sale-id="${escapeHTML(
                  perfume.id
                )}"
                type="button"
                ${
                  soldOut
                    ? "disabled"
                    : ""
                }
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


  /* ====================================
     ABRIR MODAL
  ==================================== */

  function openSaleModal(
    perfume
  ) {
    if (
      !modal ||
      !perfume
    ) {
      return;
    }

    selectedPerfume =
      perfume;

    if (modalBrand) {
      modalBrand.textContent =
        perfume.brand || "—";
    }

    if (modalName) {
      modalName.textContent =
        perfume.name || "—";
    }

    if (modalSize) {
      modalSize.textContent =
        perfume.size || "—";
    }

    if (modalCode) {
      modalCode.textContent =
        perfume.code || "—";
    }

    if (modalPrice) {
      modalPrice.textContent =
        formatCurrency(
          perfume.price
        );
    }

    if (confirmButton) {
      confirmButton.disabled =
        false;

      confirmButton.textContent =
        "Confirmar venta";
    }

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
  }


  /* ====================================
     CERRAR MODAL
  ==================================== */

  function closeSaleModal(
    force = false
  ) {
    if (
      registeringSale &&
      !force
    ) {
      return;
    }

    if (modal) {
      modal.classList.add(
        "hidden"
      );

      modal.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    document.body.classList.remove(
      "modal-open"
    );

    selectedPerfume = null;
  }


  /* ====================================
     ABRIR CONFIRMACIÓN DESDE PRODUCTO
  ==================================== */

  grid.addEventListener(
    "click",
    (event) => {
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

      if (!perfume) {
        showToast(
          "No se encontró el perfume."
        );

        return;
      }

      if (
        perfume.availability ===
        "Agotado"
      ) {
        showToast(
          "Este perfume está agotado."
        );

        return;
      }

      openSaleModal(
        perfume
      );
    }
  );


  /* ====================================
     CERRAR CON X / FONDO
  ==================================== */

  document
    .querySelectorAll(
      "[data-close-sale-modal]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          () => {
            closeSaleModal();
          }
        );
      }
    );


  /* ====================================
     CANCELAR
  ==================================== */

  cancelButton
    ?.addEventListener(
      "click",
      () => {
        closeSaleModal();
      }
    );


  /* ====================================
     ESC
  ==================================== */

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
          "Escape" &&
        modal &&
        !modal.classList.contains(
          "hidden"
        )
      ) {
        closeSaleModal();
      }
    }
  );


  /* ====================================
     CONFIRMAR VENTA
  ==================================== */

  confirmButton
    ?.addEventListener(
      "click",
      async () => {
        if (
          registeringSale ||
          !selectedPerfume
        ) {
          return;
        }

        const perfume = {
          ...selectedPerfume
        };

        registeringSale =
          true;

        confirmButton.disabled =
          true;

        confirmButton.textContent =
          "Registrando...";

        try {
          const result =
            await registerSellerSale(
              perfume.id
            );

          console.log(
            "Venta registrada:",
            result
          );

          /*
           * Recargamos el catálogo porque
           * register_sale ya descontó una
           * unidad en Supabase.
           */
          await loadSellerCatalog();

          render();

          /*
           * Cerramos únicamente después de
           * que la operación terminó bien.
           */
          registeringSale =
            false;

          closeSaleModal(
            true
          );

          showToast(
            `Venta registrada: ${perfume.name}`
          );

        } catch (error) {
          console.error(
            "Error registrando venta:",
            error
          );

          const message =
            String(
              error?.message ||
              ""
            );

          const normalizedMessage =
            normalizeForComparison(
              message
            );

          if (
            normalizedMessage.includes(
              "agotado"
            )
          ) {
            showToast(
              "El perfume ya está agotado."
            );

          } else if (
            normalizedMessage.includes(
              "desactivada"
            )
          ) {
            showToast(
              "Tu cuenta está desactivada."
            );

          } else if (
            normalizedMessage.includes(
              "solo los vendedores"
            )
          ) {
            showToast(
              "Solo los vendedores pueden registrar ventas."
            );

          } else if (
            normalizedMessage.includes(
              "iniciar sesion"
            )
          ) {
            showToast(
              "Tu sesión expiró. Inicia sesión nuevamente."
            );

          } else {
            /*
             * Mostramos el error real para
             * poder diagnosticar Supabase
             * si algo falla.
             */
            showToast(
              message ||
              "No se pudo registrar la venta."
            );
          }

          /*
           * Volvemos a consultar el catálogo
           * por seguridad.
           */
          try {
            await loadSellerCatalog();

            render();

          } catch (
            refreshError
          ) {
            console.error(
              "Error actualizando catálogo:",
              refreshError
            );
          }

        } finally {
          registeringSale =
            false;

          if (
            confirmButton &&
            selectedPerfume
          ) {
            confirmButton.disabled =
              false;

            confirmButton.textContent =
              "Confirmar venta";
          }
        }
      }
    );


  /* ====================================
     FILTROS
  ==================================== */

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


  /* ====================================
     CARGA INICIAL
  ==================================== */

  async function load() {
    grid.innerHTML = `
      <div class="seller-catalog-loading">
        Cargando catálogo...
      </div>
    `;

    if (empty) {
      empty.style.display =
        "none";
    }

    try {
      await loadSellerCatalog();

      render();

    } catch (error) {
      console.error(
        "No se pudo cargar el catálogo:",
        error
      );

      grid.innerHTML = "";

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
            error.message ||
            "Verifica tu conexión e intenta nuevamente.";
        }
      }

      showToast(
        error.message ||
        "No se pudo cargar el catálogo."
      );
    }
  }


  load();
}
/* ======================================
   VENTAS - ADMIN
====================================== */

let adminSales = [];


/* ======================================
   CARGAR VENTAS
====================================== */

async function loadAdminSales() {
  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      "get_admin_sales"
    );


  if (error) {
    console.error(
      "Error get_admin_sales:",
      error
    );

    throw new Error(
      error.message ||
      "No se pudieron cargar las ventas."
    );
  }


  adminSales =
    (data || []).map(
      (sale) => ({
        id:
          sale.id,

        perfumeId:
          sale.perfume_id,

        perfumeName:
          sale.perfume_name ||
          "",

        perfumeBrand:
          sale.perfume_brand ||
          "",

        perfumeSize:
          sale.perfume_size ||
          "",

        perfumeCode:
          sale.perfume_code ||
          "",

        salePrice:
          Number(
            sale.sale_price
          ) || 0,

        sellerId:
          sale.seller_id,

        sellerName:
          sale.seller_name ||
          "Vendedor",

        sellerEmail:
          sale.seller_email ||
          "",

        createdAt:
          sale.created_at
      })
    );


  return adminSales;
}


/* ======================================
   UTILIDADES FECHA VENTAS
====================================== */

function getLocalDateKey(
  value
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


function formatSaleDate(
  value
) {
  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return new Intl
    .DateTimeFormat(
      "es-MX",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric"
      }
    )
    .format(
      date
    );
}


function formatSaleTime(
  value
) {
  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return new Intl
    .DateTimeFormat(
      "es-MX",
      {
        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    )
    .format(
      date
    );
}


/* ======================================
   PÁGINA VENTAS
====================================== */

function initializeSalesPage() {
  const tableBody =
    document.getElementById(
      "salesTableBody"
    );


  if (!tableBody) {
    return;
  }


  const searchInput =
    document.getElementById(
      "salesSearchInput"
    );

  const sellerFilter =
    document.getElementById(
      "salesSellerFilter"
    );

  const dateFilter =
    document.getElementById(
      "salesDateFilter"
    );

  const clearButton =
    document.getElementById(
      "clearSalesFiltersButton"
    );

  const emptyState =
    document.getElementById(
      "salesEmptyState"
    );

  const salesToday =
    document.getElementById(
      "salesToday"
    );

  const revenueToday =
    document.getElementById(
      "revenueToday"
    );

  const salesMonth =
    document.getElementById(
      "salesMonth"
    );

  const revenueMonth =
    document.getElementById(
      "revenueMonth"
    );


  function updateStatistics() {
    const now =
      new Date();

    const todayKey =
      getLocalDateKey(
        now
      );

    const currentYear =
      now.getFullYear();

    const currentMonth =
      now.getMonth();


    const todaySales =
      adminSales.filter(
        (sale) =>
          getLocalDateKey(
            sale.createdAt
          ) ===
          todayKey
      );


    const monthSales =
      adminSales.filter(
        (sale) => {
          const date =
            new Date(
              sale.createdAt
            );

          return (
            !Number.isNaN(
              date.getTime()
            ) &&
            date.getFullYear() ===
              currentYear &&
            date.getMonth() ===
              currentMonth
          );
        }
      );


    const todayRevenue =
      todaySales.reduce(
        (total, sale) =>
          total +
          sale.salePrice,
        0
      );


    const monthRevenue =
      monthSales.reduce(
        (total, sale) =>
          total +
          sale.salePrice,
        0
      );


    setText(
      "salesToday",
      todaySales.length
    );

    setText(
      "revenueToday",
      formatCurrency(
        todayRevenue
      )
    );

    setText(
      "salesMonth",
      monthSales.length
    );

    setText(
      "revenueMonth",
      formatCurrency(
        monthRevenue
      )
    );
  }


  function populateSellerFilter() {
    if (!sellerFilter) {
      return;
    }


    const currentValue =
      sellerFilter.value;


    const sellers =
      new Map();


    adminSales.forEach(
      (sale) => {
        if (
          !sale.sellerId
        ) {
          return;
        }

        sellers.set(
          String(
            sale.sellerId
          ),
          sale.sellerName ||
          "Vendedor"
        );
      }
    );


    const sorted =
      [...sellers.entries()]
        .sort(
          (a, b) =>
            a[1].localeCompare(
              b[1],
              "es",
              {
                sensitivity:
                  "base"
              }
            )
        );


    sellerFilter.innerHTML = `
      <option value="Todos">
        Todos los vendedores
      </option>

      ${sorted
        .map(
          ([id, name]) => `
            <option
              value="${escapeHTML(
                id
              )}"
            >
              ${escapeHTML(
                name
              )}
            </option>
          `
        )
        .join("")}
    `;


    if (
      [...sellerFilter.options]
        .some(
          (option) =>
            option.value ===
            currentValue
        )
    ) {
      sellerFilter.value =
        currentValue;
    }
  }


  function filteredSales() {
    const query =
      normalizeText(
        searchInput?.value ||
        ""
      );

    const sellerId =
      sellerFilter?.value ||
      "Todos";

    const selectedDate =
      dateFilter?.value ||
      "";


    return adminSales.filter(
      (sale) => {
        const searchable =
          normalizeText(
            [
              sale.perfumeName,
              sale.perfumeBrand,
              sale.perfumeSize,
              sale.perfumeCode,
              sale.sellerName,
              sale.sellerEmail
            ].join(
              " "
            )
          );


        const matchesSearch =
          searchable.includes(
            query
          );


        const matchesSeller =
          sellerId ===
            "Todos" ||
          String(
            sale.sellerId
          ) ===
            sellerId;


        const matchesDate =
          !selectedDate ||
          getLocalDateKey(
            sale.createdAt
          ) ===
            selectedDate;


        return (
          matchesSearch &&
          matchesSeller &&
          matchesDate
        );
      }
    );
  }


  function renderSales() {
    const sales =
      filteredSales();


    tableBody.innerHTML =
      "";


    if (emptyState) {
      emptyState.style.display =
        sales.length === 0
          ? "block"
          : "none";
    }


    sales.forEach(
      (sale) => {
        const row =
          document.createElement(
            "tr"
          );


        row.innerHTML = `
          <td>

            <div class="sales-product-cell">

              <strong>
                ${escapeHTML(
                  sale.perfumeName
                )}
              </strong>

              <span>
                ${escapeHTML(
                  sale.perfumeBrand
                )}
                ·
                ${escapeHTML(
                  sale.perfumeSize
                )}
              </span>

              <small>
                ${escapeHTML(
                  sale.perfumeCode
                )}
              </small>

            </div>

          </td>


          <td>

            <div class="sales-seller-cell">

              <strong>
                ${escapeHTML(
                  sale.sellerName
                )}
              </strong>

              <span>
                ${escapeHTML(
                  sale.sellerEmail ||
                  "—"
                )}
              </span>

            </div>

          </td>


          <td>

            <strong class="sales-price">
              ${formatCurrency(
                sale.salePrice
              )}
            </strong>

          </td>


          <td>
            ${escapeHTML(
              formatSaleDate(
                sale.createdAt
              )
            )}
          </td>


          <td>
            ${escapeHTML(
              formatSaleTime(
                sale.createdAt
              )
            )}
          </td>
        `;


        tableBody.appendChild(
          row
        );
      }
    );
  }


  function renderEverything() {
    updateStatistics();

    populateSellerFilter();

    renderSales();
  }


  searchInput
    ?.addEventListener(
      "input",
      renderSales
    );


  sellerFilter
    ?.addEventListener(
      "change",
      renderSales
    );


  dateFilter
    ?.addEventListener(
      "change",
      renderSales
    );


  clearButton
    ?.addEventListener(
      "click",
      () => {
        if (searchInput) {
          searchInput.value =
            "";
        }

        if (sellerFilter) {
          sellerFilter.value =
            "Todos";
        }

        if (dateFilter) {
          dateFilter.value =
            "";
        }

        renderSales();
      }
    );


  async function load() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="sales-loading">
            Cargando ventas...
          </div>
        </td>
      </tr>
    `;


    if (emptyState) {
      emptyState.style.display =
        "none";
    }


    try {
      await loadAdminSales();

      renderEverything();

    } catch (error) {
      console.error(
        "Error cargando ventas:",
        error
      );

      tableBody.innerHTML =
        "";

      if (emptyState) {
        emptyState.style.display =
          "block";

        const title =
          emptyState.querySelector(
            "h3"
          );

        const paragraph =
          emptyState.querySelector(
            "p"
          );

        if (title) {
          title.textContent =
            "No se pudieron cargar las ventas";
        }

        if (paragraph) {
          paragraph.textContent =
            error.message ||
            "Intenta nuevamente.";
        }
      }

      showToast(
        error.message ||
        "No se pudieron cargar las ventas."
      );
    }
  }


  load();
}

/* ======================================
   USUARIOS
====================================== */

let sellerUsers = [];
let latestSellerCredentials = null;
let selectedSellerForPassword = null;


/* ======================================
   EDGE FUNCTION VENDEDORES
====================================== */

async function invokeSellerManager(
  action,
  payload = {}
) {
  const {
    data: sessionData,
    error: sessionError
  } =
    await supabaseClient
      .auth
      .getSession();


  if (
    sessionError ||
    !sessionData.session
  ) {
    throw new Error(
      "Tu sesión ha expirado. Inicia sesión nuevamente."
    );
  }


  const accessToken =
    sessionData.session
      .access_token;


  const {
    data,
    error
  } =
    await supabaseClient
      .functions
      .invoke(
        "clever-function",
        {
          body: {
            action,
            ...payload
          },

          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );


  if (error) {
    console.error(
      "Error Edge Function:",
      error
    );


    let message =
      error.message ||
      "No se pudo completar la operación.";


    try {
      if (
        error.context &&
        typeof error.context.json ===
          "function"
      ) {
        const errorBody =
          await error.context
            .json();


        if (errorBody?.error) {
          message =
            errorBody.error;

        } else if (
          errorBody?.message
        ) {
          message =
            errorBody.message;
        }
      }

    } catch (
      contextError
    ) {
      console.error(
        "No se pudo leer el error de la función:",
        contextError
      );
    }


    throw new Error(
      message
    );
  }


  if (
    data?.ok === false
  ) {
    throw new Error(
      data.error ||
      "No se pudo completar la operación."
    );
  }


  return data;
}


/* ======================================
   GENERAR CONTRASEÑA
====================================== */

function generateSellerPassword(
  length = 14
) {
  const lowercase =
    "abcdefghijkmnopqrstuvwxyz";

  const uppercase =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const numbers =
    "23456789";

  const symbols =
    "!@#$%*-_";

  const allCharacters =
    lowercase +
    uppercase +
    numbers +
    symbols;


  function randomIndex(max) {
    const values =
      new Uint32Array(1);


    crypto.getRandomValues(
      values
    );


    return (
      values[0] %
      max
    );
  }


  const characters = [
    lowercase[
      randomIndex(
        lowercase.length
      )
    ],

    uppercase[
      randomIndex(
        uppercase.length
      )
    ],

    numbers[
      randomIndex(
        numbers.length
      )
    ],

    symbols[
      randomIndex(
        symbols.length
      )
    ]
  ];


  while (
    characters.length <
    length
  ) {
    characters.push(
      allCharacters[
        randomIndex(
          allCharacters.length
        )
      ]
    );
  }


  for (
    let index =
      characters.length - 1;

    index > 0;

    index--
  ) {
    const position =
      randomIndex(
        index + 1
      );


    [
      characters[index],
      characters[position]
    ] = [
      characters[position],
      characters[index]
    ];
  }


  return characters.join(
    ""
  );
}


/* ======================================
   COPIAR TEXTO
====================================== */

async function copyTextToClipboard(
  text
) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator
      .clipboard
      .writeText(
        text
      );

    return;
  }


  const textarea =
    document.createElement(
      "textarea"
    );


  textarea.value =
    text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  textarea.style.pointerEvents =
    "none";


  document.body.appendChild(
    textarea
  );


  textarea.focus();

  textarea.select();


  const successful =
    document.execCommand(
      "copy"
    );


  textarea.remove();


  if (!successful) {
    throw new Error(
      "No se pudo copiar."
    );
  }
}


/* ======================================
   FORMATEAR FECHA
====================================== */

function formatUserDate(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return new Intl
    .DateTimeFormat(
      "es-MX",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric"
      }
    )
    .format(
      date
    );
}


/* ======================================
   CARGAR VENDEDORES
====================================== */

async function loadSellerUsers() {
  const result =
    await invokeSellerManager(
      "list"
    );


  sellerUsers =
    Array.isArray(
      result?.sellers
    )
      ? result.sellers
      : [];


  return sellerUsers;
}


/* ======================================
   PÁGINA USUARIOS
====================================== */

function initializeUsersPage() {
  const form =
    document.getElementById(
      "sellerUserForm"
    );


  if (!form) {
    return;
  }


  const fullNameInput =
    document.getElementById(
      "sellerFullName"
    );


  const emailInput =
    document.getElementById(
      "sellerEmail"
    );


  const passwordInput =
    document.getElementById(
      "sellerPassword"
    );


  const generateButton =
    document.getElementById(
      "generateCredentialsButton"
    );


  const submitButton =
    document.getElementById(
      "createSellerButton"
    );


  const credentialsPanel =
    document.getElementById(
      "credentialsPanel"
    );


  const credentialsEyebrow =
    document.getElementById(
      "credentialsEyebrow"
    );


  const credentialsTitle =
    document.getElementById(
      "credentialsTitle"
    );


  const createdSellerName =
    document.getElementById(
      "createdSellerName"
    );


  const createdSellerEmail =
    document.getElementById(
      "createdSellerEmail"
    );


  const createdSellerPassword =
    document.getElementById(
      "createdSellerPassword"
    );


  const copyCredentialsButton =
    document.getElementById(
      "copyCredentialsButton"
    );


  const searchInput =
    document.getElementById(
      "userSearchInput"
    );


  const tableBody =
    document.getElementById(
      "usersTableBody"
    );


  const emptyState =
    document.getElementById(
      "usersEmptyState"
    );


  const passwordModal =
    document.getElementById(
      "sellerPasswordModal"
    );


  const passwordSellerName =
    document.getElementById(
      "passwordSellerName"
    );


  const passwordSellerEmail =
    document.getElementById(
      "passwordSellerEmail"
    );


  const newPasswordInput =
    document.getElementById(
      "newSellerPassword"
    );


  const generateNewPasswordButton =
    document.getElementById(
      "generateNewPasswordButton"
    );


  const savePasswordButton =
    document.getElementById(
      "saveSellerPasswordButton"
    );


  /* ====================================
     MOSTRAR CREDENCIALES
  ==================================== */

  function showCredentials(
    seller,
    password,
    mode = "created"
  ) {
    latestSellerCredentials = {
      fullName:
        seller.fullName,

      email:
        seller.email,

      password
    };


    if (
      credentialsEyebrow
    ) {
      credentialsEyebrow.textContent =
        mode === "updated"
          ? "CONTRASEÑA ACTUALIZADA"
          : "CREDENCIALES";
    }


    if (
      credentialsTitle
    ) {
      credentialsTitle.textContent =
        mode === "updated"
          ? "Nuevo acceso del vendedor"
          : "Acceso del vendedor";
    }


    if (
      createdSellerName
    ) {
      createdSellerName.textContent =
        seller.fullName ||
        "—";
    }


    if (
      createdSellerEmail
    ) {
      createdSellerEmail.textContent =
        seller.email ||
        "—";
    }


    if (
      createdSellerPassword
    ) {
      createdSellerPassword.textContent =
        password;
    }


    credentialsPanel
      ?.classList
      .remove(
        "hidden"
      );
  }


  /* ====================================
     FILTRAR
  ==================================== */

  function filteredUsers() {
    const query =
      normalizeText(
        searchInput?.value ||
        ""
      );


    return sellerUsers.filter(
      (seller) => {
        const text =
          normalizeText(
            [
              seller.fullName,
              seller.email
            ].join(
              " "
            )
          );


        return text.includes(
          query
        );
      }
    );
  }


  /* ====================================
     RENDER
  ==================================== */

  function renderUsers() {
    if (!tableBody) {
      return;
    }


    tableBody.innerHTML =
      "";


    const users =
      filteredUsers();


    if (emptyState) {
      emptyState.style.display =
        users.length === 0
          ? "block"
          : "none";
    }


    users.forEach(
      (seller) => {
        const active =
          seller.active ===
          true;


        const row =
          document.createElement(
            "tr"
          );


        row.innerHTML = `
          <td>
            <div class="user-person-cell">

              <strong>
                ${escapeHTML(
                  seller.fullName ||
                  "Sin nombre"
                )}
              </strong>

              <small>
                Vendedor
              </small>

            </div>
          </td>


          <td>
            <span class="user-email">
              ${escapeHTML(
                seller.email ||
                "—"
              )}
            </span>
          </td>


          <td>
            <span
              class="
                user-status-badge
                ${
                  active
                    ? "user-status-active"
                    : "user-status-inactive"
                }
              "
            >
              <span
                class="user-status-dot"
              ></span>

              ${
                active
                  ? "Activo"
                  : "Desactivado"
              }
            </span>
          </td>


          <td>
            ${escapeHTML(
              formatUserDate(
                seller.createdAt
              )
            )}
          </td>


          <td>
            <div class="user-actions">

              <button
                class="
                  action-button
                  user-password-button
                "
                data-user-action="password"
                data-user-id="${escapeHTML(
                  seller.id
                )}"
                type="button"
              >
                Contraseña
              </button>


              <button
                class="
                  action-button
                  ${
                    active
                      ? "user-disable-button"
                      : "user-enable-button"
                  }
                "
                data-user-action="toggle-active"
                data-user-id="${escapeHTML(
                  seller.id
                )}"
                type="button"
              >
                ${
                  active
                    ? "Desactivar"
                    : "Reactivar"
                }
              </button>

            </div>
          </td>
        `;


        tableBody.appendChild(
          row
        );
      }
    );
  }


  /* ====================================
     GENERAR CONTRASEÑA
  ==================================== */

  generateButton
    ?.addEventListener(
      "click",
      () => {
        passwordInput.value =
          generateSellerPassword();


        passwordInput.focus();

        passwordInput.select();


        showToast(
          "Contraseña segura generada."
        );
      }
    );


  /* ====================================
     CREAR VENDEDOR
  ==================================== */

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      const fullName =
        fullNameInput.value
          .trim()
          .replace(
            /\s+/g,
            " "
          );


      const email =
        emailInput.value
          .trim()
          .toLowerCase();


      const password =
        passwordInput.value;


      if (
        fullName.length < 2
      ) {
        showToast(
          "Escribe el nombre del vendedor."
        );

        fullNameInput.focus();

        return;
      }


      if (
        !emailInput.checkValidity()
      ) {
        showToast(
          "Escribe un correo electrónico válido."
        );

        emailInput.focus();

        return;
      }


      if (
        password.length < 8
      ) {
        showToast(
          "La contraseña debe tener al menos 8 caracteres."
        );

        passwordInput.focus();

        return;
      }


      submitButton.disabled =
        true;


      submitButton.textContent =
        "Creando vendedor...";


      if (generateButton) {
        generateButton.disabled =
          true;
      }


      try {
        const result =
          await invokeSellerManager(
            "create",
            {
              fullName,
              email,
              password
            }
          );


        const createdSeller = {
          id:
            result.seller.id,

          fullName:
            result.seller
              .fullName ||
            fullName,

          email:
            result.seller
              .email ||
            email,

          active:
            true,

          createdAt:
            result.seller
              .createdAt ||
            new Date()
              .toISOString()
        };


        showCredentials(
          createdSeller,
          password,
          "created"
        );


        form.reset();


        await loadSellerUsers();


        renderUsers();


        showToast(
          "Vendedor creado correctamente."
        );


        credentialsPanel
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "nearest"
          });

      } catch (error) {
        console.error(
          "Error creando vendedor:",
          error
        );


        showToast(
          error.message ||
          "No se pudo crear el vendedor."
        );

      } finally {
        submitButton.disabled =
          false;


        submitButton.textContent =
          "+ Crear vendedor";


        if (generateButton) {
          generateButton.disabled =
            false;
        }
      }
    }
  );


  /* ====================================
     COPIAR CREDENCIALES
  ==================================== */

  copyCredentialsButton
    ?.addEventListener(
      "click",
      async () => {
        if (
          !latestSellerCredentials
        ) {
          showToast(
            "No hay credenciales para copiar."
          );

          return;
        }


        const loginUrl =
          new URL(
            "login.html",
            window.location.href
          ).href;


        const text = [
          "DUVANT12",
          "",
          `Vendedor: ${latestSellerCredentials.fullName}`,
          `Correo: ${latestSellerCredentials.email}`,
          `Contraseña: ${latestSellerCredentials.password}`,
          "",
          `Acceso: ${loginUrl}`
        ].join(
          "\n"
        );


        try {
          await copyTextToClipboard(
            text
          );


          showToast(
            "Credenciales copiadas."
          );

        } catch (error) {
          console.error(
            error
          );


          showToast(
            "No se pudieron copiar las credenciales."
          );
        }
      }
    );


  /* ====================================
     MODAL CONTRASEÑA
  ==================================== */

  function openPasswordModal(
    seller
  ) {
    selectedSellerForPassword =
      seller;


    if (
      passwordSellerName
    ) {
      passwordSellerName.textContent =
        seller.fullName ||
        "Vendedor";
    }


    if (
      passwordSellerEmail
    ) {
      passwordSellerEmail.textContent =
        seller.email ||
        "—";
    }


    if (
      newPasswordInput
    ) {
      newPasswordInput.value =
        "";
    }


    passwordModal
      ?.classList
      .remove(
        "hidden"
      );


    passwordModal
      ?.setAttribute(
        "aria-hidden",
        "false"
      );


    document.body.classList.add(
      "modal-open"
    );


    setTimeout(
      () => {
        newPasswordInput
          ?.focus();
      },
      50
    );
  }


  function closePasswordModal() {
    passwordModal
      ?.classList
      .add(
        "hidden"
      );


    passwordModal
      ?.setAttribute(
        "aria-hidden",
        "true"
      );


    document.body.classList.remove(
      "modal-open"
    );


    selectedSellerForPassword =
      null;


    if (
      newPasswordInput
    ) {
      newPasswordInput.value =
        "";
    }
  }


  document
    .querySelectorAll(
      "[data-close-seller-password-modal]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          closePasswordModal
        );
      }
    );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
          "Escape" &&
        passwordModal &&
        !passwordModal
          .classList
          .contains(
            "hidden"
          )
      ) {
        closePasswordModal();
      }
    }
  );


  generateNewPasswordButton
    ?.addEventListener(
      "click",
      () => {
        if (
          !newPasswordInput
        ) {
          return;
        }


        newPasswordInput.value =
          generateSellerPassword();


        newPasswordInput.focus();

        newPasswordInput.select();


        showToast(
          "Nueva contraseña generada."
        );
      }
    );


  /* ====================================
     GUARDAR NUEVA CONTRASEÑA
  ==================================== */

  savePasswordButton
    ?.addEventListener(
      "click",
      async () => {
        if (
          !selectedSellerForPassword ||
          !newPasswordInput
        ) {
          return;
        }


        const password =
          newPasswordInput.value;


        if (
          password.length < 8
        ) {
          showToast(
            "La contraseña debe tener al menos 8 caracteres."
          );


          newPasswordInput.focus();

          return;
        }


        const seller = {
          ...selectedSellerForPassword
        };


        savePasswordButton.disabled =
          true;


        savePasswordButton.textContent =
          "Guardando...";


        if (
          generateNewPasswordButton
        ) {
          generateNewPasswordButton.disabled =
            true;
        }


        try {
          await invokeSellerManager(
            "change-password",
            {
              sellerId:
                seller.id,

              password
            }
          );


          closePasswordModal();


          showCredentials(
            seller,
            password,
            "updated"
          );


          showToast(
            "Contraseña actualizada correctamente."
          );


          credentialsPanel
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "nearest"
            });

        } catch (error) {
          console.error(
            "Error cambiando contraseña:",
            error
          );


          showToast(
            error.message ||
            "No se pudo cambiar la contraseña."
          );

        } finally {
          savePasswordButton.disabled =
            false;


          savePasswordButton.textContent =
            "Guardar contraseña";


          if (
            generateNewPasswordButton
          ) {
            generateNewPasswordButton.disabled =
              false;
          }
        }
      }
    );


  /* ====================================
     ACCIONES TABLA
  ==================================== */

  tableBody
    ?.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target.closest(
            "[data-user-action]"
          );


        if (!button) {
          return;
        }


        const seller =
          sellerUsers.find(
            (item) =>
              String(
                item.id
              ) ===
              String(
                button.dataset
                  .userId
              )
          );


        if (!seller) {
          showToast(
            "No se encontró al vendedor."
          );

          return;
        }


        const action =
          button.dataset
            .userAction;


        if (
          action ===
          "password"
        ) {
          openPasswordModal(
            seller
          );

          return;
        }


        if (
          action ===
          "toggle-active"
        ) {
          const newActiveState =
            !seller.active;


          const message =
            newActiveState
              ? `¿Reactivar el acceso de "${seller.fullName}"?`
              : `¿Desactivar el acceso de "${seller.fullName}"?`;


          const confirmed =
            window.confirm(
              message
            );


          if (!confirmed) {
            return;
          }


          button.disabled =
            true;


          const originalText =
            button.textContent;


          button.textContent =
            newActiveState
              ? "Reactivando..."
              : "Desactivando...";


          try {
            await invokeSellerManager(
              "set-active",
              {
                sellerId:
                  seller.id,

                active:
                  newActiveState
              }
            );


            seller.active =
              newActiveState;


            renderUsers();


            showToast(
              newActiveState
                ? "Acceso reactivado."
                : "Acceso desactivado."
            );

          } catch (error) {
            console.error(
              "Error cambiando acceso:",
              error
            );


            button.disabled =
              false;


            button.textContent =
              originalText;


            showToast(
              error.message ||
              "No se pudo cambiar el acceso."
            );
          }
        }
      }
    );


  /* ====================================
     BUSCADOR
  ==================================== */

  searchInput
    ?.addEventListener(
      "input",
      renderUsers
    );


  /* ====================================
     CARGA INICIAL
  ==================================== */

  async function loadUsersPage() {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="users-loading">
              Cargando vendedores...
            </div>
          </td>
        </tr>
      `;
    }


    if (emptyState) {
      emptyState.style.display =
        "none";
    }


    try {
      await loadSellerUsers();


      renderUsers();

    } catch (error) {
      console.error(
        "Error cargando vendedores:",
        error
      );


      if (tableBody) {
        tableBody.innerHTML =
          "";
      }


      if (emptyState) {
        emptyState.style.display =
          "block";


        const title =
          emptyState.querySelector(
            "h3"
          );


        const paragraph =
          emptyState.querySelector(
            "p"
          );


        if (title) {
          title.textContent =
            "No se pudieron cargar los vendedores";
        }


        if (paragraph) {
          paragraph.textContent =
            error.message ||
            "Verifica la conexión e intenta nuevamente.";
        }
      }


      showToast(
        error.message ||
        "No se pudieron cargar los vendedores."
      );
    }
  }


  loadUsersPage();
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


  const isSalesPage =
    Boolean(
      document.getElementById(
        "salesTableBody"
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
    isSalesPage &&
    auth.profile.role ===
      "admin"
  ) {
    initializeSalesPage();
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