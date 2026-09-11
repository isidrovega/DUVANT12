"use strict";


/* ==========================================
   DUVANT 12
   PEDIDOS ONLINE ADMIN
========================================== */

const STORE_SUPABASE_URL =
  "https://jqkmnoxqtoqzdbvrwgil.supabase.co";

const ADMIN_ONLINE_ORDERS_ENDPOINT =
  `${STORE_SUPABASE_URL}/functions/v1/admin-online-orders`;


let onlineOrders = [];
let selectedOnlineOrder = null;
let ordersLoading = false;


/* ==========================================
   HELPERS
========================================== */

function ordersEscapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function ordersNormalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function ordersFormatCurrency(value) {
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


function ordersFormatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}


function ordersSetText(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value ?? "";
  }
}


function getFulfillmentLabel(
  status
) {
  const labels = {
    pending:
      "Pendiente",

    preparing:
      "Preparando",

    shipped:
      "Enviado",

    delivered:
      "Entregado",

    cancelled:
      "Cancelado"
  };

  return (
    labels[status] ||
    "Pendiente"
  );
}


function getFulfillmentClass(
  status
) {
  const validStatuses =
    new Set([
      "pending",
      "preparing",
      "shipped",
      "delivered"
    ]);

  return validStatuses.has(status)
    ? status
    : "pending";
}


/* ==========================================
   SESIÓN ADMIN
========================================== */

async function getAdminAccessToken() {
  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();

  if (error) {
    console.error(
      "Error leyendo sesión:",
      error
    );

    throw new Error(
      "No se pudo verificar la sesión."
    );
  }


  const session =
    data.session;

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Tu sesión expiró. Inicia sesión nuevamente."
    );
  }


  return session.access_token;
}


/* ==========================================
   LLAMAR EDGE FUNCTION STORE
========================================== */

async function callOnlineOrdersFunction(
  payload
) {
  const accessToken =
    await getAdminAccessToken();


  const response =
    await fetch(
      ADMIN_ONLINE_ORDERS_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${accessToken}`
        },

        cache: "no-store",

        body:
          JSON.stringify(payload)
      }
    );


  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }


  if (!response.ok) {
    const errorCode =
      result?.error ||
      "REQUEST_FAILED";


    if (
      response.status === 401
    ) {
      throw new Error(
        "Tu sesión no es válida. Inicia sesión nuevamente."
      );
    }


    if (
      response.status === 403
    ) {
      throw new Error(
        "Esta cuenta no tiene permisos de administrador."
      );
    }


    if (
      errorCode ===
      "INVALID_FULFILLMENT_TRANSITION"
    ) {
      throw new Error(
        "El pedido cambió de estado. Actualiza la página e inténtalo nuevamente."
      );
    }


    if (
      errorCode ===
      "FULFILLMENT_CONFLICT"
    ) {
      throw new Error(
        "Otro proceso actualizó este pedido. Vuelve a cargarlo."
      );
    }


    throw new Error(
      "No se pudo completar la operación."
    );
  }


  if (!result?.ok) {
    throw new Error(
      "El servidor no pudo completar la operación."
    );
  }


  return result;
}


/* ==========================================
   CARGAR PEDIDOS
========================================== */

async function loadOnlineOrders() {
  if (ordersLoading) {
    return;
  }


  ordersLoading = true;

  const refreshButton =
    document.getElementById(
      "refreshOrdersButton"
    );

  const tableBody =
    document.getElementById(
      "ordersTableBody"
    );


  if (refreshButton) {
    refreshButton.disabled =
      true;

    refreshButton.textContent =
      "Actualizando...";
  }


  if (
    tableBody &&
    onlineOrders.length === 0
  ) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="orders-loading">
            Cargando pedidos online...
          </div>
        </td>
      </tr>
    `;
  }


  try {
    const result =
      await callOnlineOrdersFunction({
        action:
          "list",

        limit:
          100
      });


    onlineOrders =
      Array.isArray(
        result.orders
      )
        ? result.orders
        : [];


    renderOnlineOrders();

  } catch (error) {
    console.error(
      "Error cargando pedidos:",
      error
    );


    onlineOrders = [];


    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="orders-loading">
              ${ordersEscapeHTML(
                error.message ||
                "No se pudieron cargar los pedidos."
              )}
            </div>
          </td>
        </tr>
      `;
    }


    showToast(
      error.message ||
      "No se pudieron cargar los pedidos."
    );

  } finally {
    ordersLoading =
      false;


    if (refreshButton) {
      refreshButton.disabled =
        false;

      refreshButton.textContent =
        "Actualizar";
    }
  }
}


/* ==========================================
   FILTRAR
========================================== */

function getFilteredOnlineOrders() {
  const searchInput =
    document.getElementById(
      "ordersSearchInput"
    );

  const statusFilter =
    document.getElementById(
      "ordersStatusFilter"
    );


  const search =
    ordersNormalizeText(
      searchInput?.value
    );

  const status =
    String(
      statusFilter?.value ||
      ""
    );


  return onlineOrders.filter(
    (order) => {
      if (
        status &&
        order.fulfillment_status !==
          status
      ) {
        return false;
      }


      if (!search) {
        return true;
      }


      const searchable =
        ordersNormalizeText([
          order.order_number,
          order.first_name,
          order.last_name,
          order.email,
          order.phone,
          order.shipping_city,
          order.shipping_state,
          order.tracking_number,
          order.shipping_carrier
        ].join(" "));


      return searchable.includes(
        search
      );
    }
  );
}


/* ==========================================
   ESTADÍSTICAS
========================================== */

function updateOrdersStats() {
  const count =
    (status) =>
      onlineOrders.filter(
        (order) =>
          (
            order.fulfillment_status ||
            "pending"
          ) === status
      ).length;


  ordersSetText(
    "ordersPendingCount",
    count("pending")
  );

  ordersSetText(
    "ordersPreparingCount",
    count("preparing")
  );

  ordersSetText(
    "ordersShippedCount",
    count("shipped")
  );

  ordersSetText(
    "ordersDeliveredCount",
    count("delivered")
  );
}


/* ==========================================
   TABLA
========================================== */

function renderOnlineOrders() {
  const tableBody =
    document.getElementById(
      "ordersTableBody"
    );

  const emptyState =
    document.getElementById(
      "ordersEmptyState"
    );


  if (!tableBody) {
    return;
  }


  updateOrdersStats();


  const filtered =
    getFilteredOnlineOrders();


  if (
    filtered.length === 0
  ) {
    tableBody.innerHTML =
      "";

    if (emptyState) {
      emptyState.hidden =
        false;
    }

    return;
  }


  if (emptyState) {
    emptyState.hidden =
      true;
  }


  tableBody.innerHTML =
    filtered
      .map(
        (order) => {
          const status =
            getFulfillmentClass(
              order.fulfillment_status
            );

          const customerName =
            [
              order.first_name,
              order.last_name
            ]
              .filter(Boolean)
              .join(" ") ||
            "Cliente";


          return `
            <tr>

              <td>
                <div class="order-number-cell">

                  <strong>
                    ${ordersEscapeHTML(
                      order.order_number ||
                      "—"
                    )}
                  </strong>

                  <span>
                    Mercado Pago
                  </span>

                </div>
              </td>


              <td>
                <div class="order-client-cell">

                  <strong>
                    ${ordersEscapeHTML(
                      customerName
                    )}
                  </strong>

                  <span>
                    ${ordersEscapeHTML(
                      order.email ||
                      "Sin email"
                    )}
                  </span>

                </div>
              </td>


              <td class="order-date-cell">
                ${ordersEscapeHTML(
                  ordersFormatDate(
                    order.created_at
                  )
                )}
              </td>


              <td class="order-total-cell">
                ${ordersEscapeHTML(
                  ordersFormatCurrency(
                    order.total
                  )
                )}
              </td>


              <td>
                <span class="order-payment-badge">
                  Pagado
                </span>
              </td>


              <td>
                <span
                  class="
                    order-status-badge
                    order-status-${status}
                  "
                >
                  ${ordersEscapeHTML(
                    getFulfillmentLabel(
                      status
                    )
                  )}
                </span>
              </td>


              <td>

                <button
                  class="order-view-button"
                  type="button"
                  data-order-id="${ordersEscapeHTML(
                    order.id
                  )}"
                >
                  Ver pedido
                </button>

              </td>

            </tr>
          `;
        }
      )
      .join("");


  tableBody
    .querySelectorAll(
      "[data-order-id]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openOnlineOrder(
              button.dataset.orderId
            );
          }
        );
      }
    );
}


/* ==========================================
   ABRIR MODAL
========================================== */

async function openOnlineOrder(
  orderId
) {
  const modal =
    document.getElementById(
      "orderModal"
    );

  const loading =
    document.getElementById(
      "orderModalLoading"
    );

  const content =
    document.getElementById(
      "orderModalContent"
    );


  if (!modal) {
    return;
  }


  modal.hidden =
    false;

  document.body.style.overflow =
    "hidden";


  if (loading) {
    loading.hidden =
      false;

    loading.textContent =
      "Cargando información del pedido...";
  }


  if (content) {
    content.hidden =
      true;
  }


  try {
    const result =
      await callOnlineOrdersFunction({
        action:
          "detail",

        order_id:
          orderId
      });


    selectedOnlineOrder =
      result.order;


    renderOrderDetail(
      selectedOnlineOrder
    );

  } catch (error) {
    console.error(
      "Error cargando detalle:",
      error
    );


    if (loading) {
      loading.textContent =
        error.message ||
        "No se pudo cargar el pedido.";
    }


    showToast(
      error.message ||
      "No se pudo cargar el pedido."
    );
  }
}


/* ==========================================
   CERRAR MODAL
========================================== */

function closeOrderModal() {
  const modal =
    document.getElementById(
      "orderModal"
    );


  if (!modal) {
    return;
  }


  modal.hidden =
    true;

  document.body.style.overflow =
    "";


  selectedOnlineOrder =
    null;
}


/* ==========================================
   DIRECCIÓN
========================================== */

function getOrderAddressHTML(
  order
) {
  const line1 =
    [
      order.shipping_address,
      order.shipping_address2
    ]
      .filter(Boolean)
      .join(", ");


  const line2 =
    [
      order.shipping_neighborhood,
      order.shipping_postal_code
    ]
      .filter(Boolean)
      .join(", ");


  const line3 =
    [
      order.shipping_city,
      order.shipping_state
    ]
      .filter(Boolean)
      .join(", ");


  const line4 =
    order.shipping_country ||
    "";


  return [
    line1,
    line2,
    line3,
    line4
  ]
    .filter(Boolean)
    .map(
      (line) =>
        ordersEscapeHTML(line)
    )
    .join("<br>");
}


/* ==========================================
   PRODUCTOS
========================================== */

function renderOrderProducts(
  items
) {
  const container =
    document.getElementById(
      "orderProducts"
    );


  if (!container) {
    return;
  }


  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    container.innerHTML = `
      <div class="orders-loading">
        No hay productos disponibles.
      </div>
    `;

    return;
  }


  container.innerHTML =
    items
      .map(
        (item) => {
          const productName =
            [
              item.brand,
              item.name
            ]
              .filter(Boolean)
              .join(" ");


          const productMeta =
            [
              item.code,
              item.size
            ]
              .filter(Boolean)
              .join(" · ");


          return `
            <div class="order-product-row">

              <div class="order-product-name">

                <strong>
                  ${ordersEscapeHTML(
                    productName ||
                    "Producto"
                  )}
                </strong>

                <span>
                  ${ordersEscapeHTML(
                    productMeta
                  )}
                </span>

              </div>


              <div class="order-product-price">

                <strong>
                  ${ordersEscapeHTML(
                    ordersFormatCurrency(
                      item.line_total
                    )
                  )}
                </strong>

                <span>
                  ${ordersEscapeHTML(
                    String(
                      Number(
                        item.quantity
                      ) || 0
                    )
                  )}
                  ×
                  ${ordersEscapeHTML(
                    ordersFormatCurrency(
                      item.unit_price
                    )
                  )}
                </span>

              </div>

            </div>
          `;
        }
      )
      .join("");
}


/* ==========================================
   PROGRESO
========================================== */

function renderOrderProgress(
  currentStatus
) {
  const container =
    document.getElementById(
      "orderProgress"
    );


  if (!container) {
    return;
  }


  const steps = [
    {
      value:
        "pending",

      label:
        "Pendiente"
    },

    {
      value:
        "preparing",

      label:
        "Preparando"
    },

    {
      value:
        "shipped",

      label:
        "Enviado"
    },

    {
      value:
        "delivered",

      label:
        "Entregado"
    }
  ];


  const currentIndex =
    Math.max(
      steps.findIndex(
        (step) =>
          step.value ===
          currentStatus
      ),
      0
    );


  container.innerHTML =
    steps
      .map(
        (
          step,
          index
        ) => {
          let stateClass =
            "";

          if (
            index <
            currentIndex
          ) {
            stateClass =
              "done";
          } else if (
            index ===
            currentIndex
          ) {
            stateClass =
              "current";
          }


          if (
            currentStatus ===
              "delivered" &&
            index ===
              currentIndex
          ) {
            stateClass =
              "done current";
          }


          return `
            <div
              class="
                order-progress-step
                ${stateClass}
              "
            >
              ${ordersEscapeHTML(
                step.label
              )}
            </div>
          `;
        }
      )
      .join("");
}


/* ==========================================
   SIGUIENTE ACCIÓN
========================================== */

function renderNextOrderAction(
  status
) {
  const container =
    document.getElementById(
      "orderNextAction"
    );


  if (!container) {
    return;
  }


  const actions = {
    pending: {
      next:
        "preparing",

      label:
        "Marcar como preparando"
    },

    preparing: {
      next:
        "shipped",

      label:
        "Marcar como enviado"
    },

    shipped: {
      next:
        "delivered",

      label:
        "Marcar como entregado"
    }
  };


  const action =
    actions[status];


  if (!action) {
    container.innerHTML = `
      <span class="order-completed-label">
        Pedido completado
      </span>
    `;

    return;
  }


  container.innerHTML = `
    <button
      id="advanceOrderButton"
      class="order-next-button"
      type="button"
      data-next-status="${ordersEscapeHTML(
        action.next
      )}"
    >
      ${ordersEscapeHTML(
        action.label
      )}
    </button>
  `;


  document
    .getElementById(
      "advanceOrderButton"
    )
    ?.addEventListener(
      "click",
      handleAdvanceOrder
    );
}


/* ==========================================
   RENDER DETALLE
========================================== */

function renderOrderDetail(
  order
) {
  const loading =
    document.getElementById(
      "orderModalLoading"
    );

  const content =
    document.getElementById(
      "orderModalContent"
    );

  const notesSection =
    document.getElementById(
      "orderNotesSection"
    );

  const address =
    document.getElementById(
      "orderShippingAddress"
    );

  const carrierInput =
    document.getElementById(
      "shippingCarrierInput"
    );

  const trackingInput =
    document.getElementById(
      "trackingNumberInput"
    );


  const customerName =
    [
      order.first_name,
      order.last_name
    ]
      .filter(Boolean)
      .join(" ") ||
    "Cliente";


  const status =
    getFulfillmentClass(
      order.fulfillment_status
    );


  ordersSetText(
    "orderModalTitle",
    order.order_number ||
    "Pedido"
  );


  ordersSetText(
    "orderModalDate",
    ordersFormatDate(
      order.created_at
    )
  );


  ordersSetText(
    "orderDetailTotal",
    ordersFormatCurrency(
      order.total
    )
  );


  ordersSetText(
    "orderDetailPayment",
    "Pago confirmado"
  );


  ordersSetText(
    "orderDetailStatus",
    getFulfillmentLabel(
      status
    )
  );


  ordersSetText(
    "orderCustomerName",
    customerName
  );


  ordersSetText(
    "orderCustomerPhone",
    order.phone ||
    "—"
  );


  ordersSetText(
    "orderCustomerEmail",
    order.email ||
    "—"
  );


  if (address) {
    address.innerHTML =
      getOrderAddressHTML(
        order
      ) ||
      "—";
  }


  renderOrderProducts(
    order.items
  );


  const notes =
    String(
      order.customer_notes ||
      ""
    ).trim();


  if (
    notesSection
  ) {
    notesSection.hidden =
      !notes;
  }


  ordersSetText(
    "orderCustomerNotes",
    notes
  );


  if (carrierInput) {
    carrierInput.value =
      order.shipping_carrier ||
      "";
  }


  if (trackingInput) {
    trackingInput.value =
      order.tracking_number ||
      "";
  }


  /*
   * Una vez enviado, dejamos visibles los datos
   * pero evitamos que se modifiquen accidentalmente.
   */
  const shippingLocked =
    status ===
      "shipped" ||
    status ===
      "delivered";


  if (carrierInput) {
    carrierInput.disabled =
      shippingLocked;
  }


  if (trackingInput) {
    trackingInput.disabled =
      shippingLocked;
  }


  renderOrderProgress(
    status
  );


  renderNextOrderAction(
    status
  );


  if (loading) {
    loading.hidden =
      true;
  }


  if (content) {
    content.hidden =
      false;
  }
}


/* ==========================================
   ACTUALIZAR ESTADO
========================================== */

async function handleAdvanceOrder(
  event
) {
  if (
    !selectedOnlineOrder
  ) {
    return;
  }


  const button =
    event.currentTarget;

  const nextStatus =
    button.dataset.nextStatus;


  if (!nextStatus) {
    return;
  }


  const carrierInput =
    document.getElementById(
      "shippingCarrierInput"
    );

  const trackingInput =
    document.getElementById(
      "trackingNumberInput"
    );


  const shippingCarrier =
    String(
      carrierInput?.value ||
      ""
    ).trim();

  const trackingNumber =
    String(
      trackingInput?.value ||
      ""
    ).trim();


  /*
   * Para enviar sí pedimos ambos datos.
   *
   * Esto evita marcar un paquete como enviado
   * y después olvidar agregar su guía.
   */
  if (
    nextStatus ===
      "shipped" &&
    !shippingCarrier
  ) {
    showToast(
      "Escribe la paquetería antes de marcar el pedido como enviado."
    );

    carrierInput?.focus();

    return;
  }


  if (
    nextStatus ===
      "shipped" &&
    !trackingNumber
  ) {
    showToast(
      "Escribe el número de rastreo antes de marcar el pedido como enviado."
    );

    trackingInput?.focus();

    return;
  }


  const originalText =
    button.textContent;


  button.disabled =
    true;

  button.textContent =
    "Actualizando...";


  try {
    const result =
      await callOnlineOrdersFunction({
        action:
          "update_fulfillment",

        order_id:
          selectedOnlineOrder.id,

        fulfillment_status:
          nextStatus,

        shipping_carrier:
          shippingCarrier,

        tracking_number:
          trackingNumber
      });


    const updated =
      result.order;


    selectedOnlineOrder = {
      ...selectedOnlineOrder,
      ...updated
    };


    /*
     * Actualizamos también la lista local.
     */
    onlineOrders =
      onlineOrders.map(
        (order) =>
          order.id ===
            selectedOnlineOrder.id
            ? {
                ...order,
                ...updated
              }
            : order
      );


    renderOnlineOrders();

    renderOrderDetail(
      selectedOnlineOrder
    );


    const successMessages = {
      preparing:
        "Pedido marcado como preparando.",

      shipped:
        "Pedido marcado como enviado.",

      delivered:
        "Pedido marcado como entregado."
    };


    showToast(
      successMessages[
        nextStatus
      ] ||
      "Pedido actualizado."
    );

  } catch (error) {
    console.error(
      "Error actualizando pedido:",
      error
    );


    showToast(
      error.message ||
      "No se pudo actualizar el pedido."
    );


    button.disabled =
      false;

    button.textContent =
      originalText;
  }
}


/* ==========================================
   EVENTOS
========================================== */

function initializeOrdersEvents() {
  document
    .getElementById(
      "ordersSearchInput"
    )
    ?.addEventListener(
      "input",
      renderOnlineOrders
    );


  document
    .getElementById(
      "ordersStatusFilter"
    )
    ?.addEventListener(
      "change",
      renderOnlineOrders
    );


  document
    .getElementById(
      "refreshOrdersButton"
    )
    ?.addEventListener(
      "click",
      loadOnlineOrders
    );


  document
    .querySelectorAll(
      "[data-close-order-modal]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          closeOrderModal
        );
      }
    );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeOrderModal();
      }
    }
  );
}


/* ==========================================
   INICIALIZAR
========================================== */

async function initializeOnlineOrdersPage() {
  const tableBody =
    document.getElementById(
      "ordersTableBody"
    );


  if (!tableBody) {
    return;
  }


  initializeOrdersEvents();


  /*
   * script.js también protege la página.
   * Esperamos aquí la sesión real porque esta
   * sesión será enviada a la Edge Function.
   */
  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (
      error ||
      !data.session
    ) {
      return;
    }


    await loadOnlineOrders();

  } catch (error) {
    console.error(
      "No se pudo inicializar Pedidos Online:",
      error
    );


    showToast(
      "No se pudieron cargar los pedidos online."
    );
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeOnlineOrdersPage
);