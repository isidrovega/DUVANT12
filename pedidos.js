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


function ordersFormatShippingDate(value) {
  if (!value) {
    return "—";
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return "—";
  }

  /*
   * Si EnviaTodo devuelve YYYY-MM-DD,
   * agregamos mediodía local para evitar
   * desplazamientos de zona horaria.
   */
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? `${raw}T12:00:00`
      : raw;

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return raw;
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium"
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


function ordersSetHidden(
  id,
  hidden
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.hidden =
      Boolean(hidden);
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


function getResolvedCarrier(
  order
) {
  return String(
    order?.shipping_provider_name ||
    order?.shipping_carrier ||
    ""
  ).trim();
}


function getResolvedTracking(
  order
) {
  return String(
    order?.shipping_tracking_id ||
    order?.tracking_number ||
    ""
  ).trim();
}


function getResolvedShippingStatus(
  order
) {
  return String(
    order?.shipping_status ||
    order?.shipping_generation_status ||
    ""
  ).trim();
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

        cache:
          "no-store",

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


    if (
      errorCode ===
      "SHIPPING_CARRIER_REQUIRED"
    ) {
      throw new Error(
        "Este pedido todavía no tiene una paquetería válida."
      );
    }


    if (
      errorCode ===
      "TRACKING_NUMBER_REQUIRED"
    ) {
      throw new Error(
        "Este pedido todavía no tiene un número de rastreo válido."
      );
    }


    if (
      errorCode ===
      "SHIPPING_GUIDE_NOT_CREATED"
    ) {
      throw new Error(
        "La guía de este pedido todavía no ha sido generada."
      );
    }


    if (
      errorCode ===
      "SHIPPING_LABEL_NOT_AVAILABLE"
    ) {
      throw new Error(
        "La etiqueta PDF todavía no está disponible."
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
          order.shipping_provider_name,
          order.shipping_carrier,
          order.shipping_service_name,
          order.shipping_guide_id,
          order.shipping_tracking_id,
          order.tracking_number
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
   LOGÍSTICA
========================================== */

function renderShippingInformation(
  order
) {
  const carrier =
    getResolvedCarrier(
      order
    );

  const tracking =
    getResolvedTracking(
      order
    );

  const automaticCarrier =
    String(
      order.shipping_provider_name ||
      ""
    ).trim();

  const automaticTracking =
    String(
      order.shipping_tracking_id ||
      ""
    ).trim();

  const serviceName =
    String(
      order.shipping_service_name ||
      ""
    ).trim();

  const viaTransport =
    String(
      order.shipping_via_transport ||
      ""
    ).trim();

  const deliveryMode =
    String(
      order.shipping_delivery_mode ||
      ""
    ).trim();

  const guideId =
    String(
      order.shipping_guide_id ||
      ""
    ).trim();

  const shippingStatus =
    getResolvedShippingStatus(
      order
    );

  const statusCode =
    String(
      order.shipping_status_code ||
      ""
    ).trim();

  const generationStatus =
    String(
      order.shipping_generation_status ||
      ""
    ).trim();

  const labelPath =
    String(
      order.shipping_label_storage_path ||
      ""
    ).trim();


  ordersSetText(
    "shippingProviderValue",
    carrier || "—"
  );

  ordersSetText(
    "shippingServiceValue",
    serviceName || "—"
  );

  ordersSetText(
    "shippingTransportValue",
    viaTransport || "—"
  );

  ordersSetText(
    "shippingDeliveryModeValue",
    deliveryMode || "—"
  );

  ordersSetText(
    "shippingEstimatedDateValue",
    ordersFormatShippingDate(
      order.shipping_estimated_date
    )
  );

  ordersSetText(
    "shippingGuideValue",
    guideId || "—"
  );

  ordersSetText(
    "shippingTrackingValue",
    tracking || "—"
  );

  ordersSetText(
    "shippingStatusValue",
    shippingStatus || "—"
  );

  ordersSetText(
    "shippingStatusCodeValue",
    statusCode || "—"
  );

  ordersSetText(
    "shippingGenerationValue",
    generationStatus || "—"
  );


  /*
   * El fallback manual solamente aparece
   * cuando el pedido no tiene todavía los
   * datos automáticos necesarios.
   */

  const manualFallback =
    document.getElementById(
      "manualShippingFallback"
    );

  const carrierLabel =
    document.getElementById(
      "shippingCarrierFallbackLabel"
    );

  const trackingLabel =
    document.getElementById(
      "trackingFallbackLabel"
    );

  const carrierInput =
    document.getElementById(
      "shippingCarrierInput"
    );

  const trackingInput =
    document.getElementById(
      "trackingNumberInput"
    );


  const needsCarrierFallback =
    !automaticCarrier &&
    !String(
      order.shipping_carrier ||
      ""
    ).trim();

  const needsTrackingFallback =
    !automaticTracking &&
    !String(
      order.tracking_number ||
      ""
    ).trim();


  if (manualFallback) {
    manualFallback.hidden =
      !(
        needsCarrierFallback ||
        needsTrackingFallback
      );
  }


  if (carrierLabel) {
    carrierLabel.hidden =
      !needsCarrierFallback;
  }


  if (trackingLabel) {
    trackingLabel.hidden =
      !needsTrackingFallback;
  }


  if (carrierInput) {
    carrierInput.value =
      carrier || "";

    carrierInput.disabled =
      !needsCarrierFallback;
  }


  if (trackingInput) {
    trackingInput.value =
      tracking || "";

    trackingInput.disabled =
      !needsTrackingFallback;
  }


  /*
   * Botón de etiqueta.
   */

  const downloadButton =
    document.getElementById(
      "downloadShippingLabelButton"
    );

  const labelUnavailable =
    document.getElementById(
      "shippingLabelUnavailable"
    );


  const labelAvailable =
    Boolean(
      guideId &&
      labelPath
    );


  if (downloadButton) {
  downloadButton.hidden =
    !labelAvailable;

  downloadButton.style.display =
    labelAvailable
      ? ""
      : "none";

  downloadButton.disabled =
    false;

  downloadButton.textContent =
    "Descargar guía PDF";
}


if (labelUnavailable) {
  labelUnavailable.hidden =
    labelAvailable;

  labelUnavailable.style.display =
    labelAvailable
      ? "none"
      : "";

  labelUnavailable.textContent =
    guideId
      ? "La guía existe, pero el PDF todavía no está disponible."
      : "La guía todavía no ha sido generada.";
}
}


/* ==========================================
   DESCARGAR GUÍA
========================================== */

async function handleDownloadShippingLabel() {
  if (
    !selectedOnlineOrder?.id
  ) {
    return;
  }


  const button =
    document.getElementById(
      "downloadShippingLabelButton"
    );


  const originalText =
    button?.textContent ||
    "Descargar guía PDF";


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Preparando PDF...";
  }


  try {
    const result =
      await callOnlineOrdersFunction({
        action:
          "download_label",

        order_id:
          selectedOnlineOrder.id
      });


    const downloadUrl =
      String(
        result.download_url ||
        ""
      ).trim();


    if (!downloadUrl) {
      throw new Error(
        "No se recibió una URL válida para descargar la guía."
      );
    }


    const link =
      document.createElement(
        "a"
      );

    link.href =
      downloadUrl;

    link.target =
      "_blank";

    link.rel =
      "noopener noreferrer";


    if (result.filename) {
      link.download =
        String(
          result.filename
        );
    }


    document.body.appendChild(
      link
    );

    link.click();

    link.remove();


    showToast(
      "Guía preparada para descarga."
    );

  } catch (error) {
    console.error(
      "Error descargando guía:",
      error
    );


    showToast(
      error.message ||
      "No se pudo descargar la guía."
    );

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        originalText;
    }
  }
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


  renderShippingInformation(
    order
  );


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


  /*
   * Primero utilizamos los datos automáticos.
   *
   * Solamente si no existen se usa el fallback
   * manual visible en el panel.
   */

  const automaticCarrier =
    getResolvedCarrier(
      selectedOnlineOrder
    );

  const automaticTracking =
    getResolvedTracking(
      selectedOnlineOrder
    );


  const manualCarrier =
    String(
      carrierInput?.value ||
      ""
    ).trim();

  const manualTracking =
    String(
      trackingInput?.value ||
      ""
    ).trim();


  const shippingCarrier =
    automaticCarrier ||
    manualCarrier;

  const trackingNumber =
    automaticTracking ||
    manualTracking;


  if (
    nextStatus ===
      "shipped" &&
    !shippingCarrier
  ) {
    showToast(
      "Este pedido no tiene paquetería. Captúrala antes de marcarlo como enviado."
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
      "Este pedido no tiene número de rastreo. Captúralo antes de marcarlo como enviado."
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

        /*
         * El backend vuelve a resolver los datos
         * y da prioridad a EnviaTodo.
         *
         * Estos valores sirven como fallback.
         */

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
    .getElementById(
      "downloadShippingLabelButton"
    )
    ?.addEventListener(
      "click",
      handleDownloadShippingLabel
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
   *
   * Esperamos aquí la sesión real porque
   * esta sesión será enviada a la Edge Function.
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