const disabled = () => {
  const error = new Error('Supplier execution is disabled.');
  error.code = 'inventory_supplier_execution_disabled';
  throw error;
};

export const SUPPLIER_ADAPTER_METHODS = Object.freeze([
  'validateConnection',
  'quoteOrPriceCheck',
  'submitOrder',
  'getOrder',
  'cancelOrder',
  'listShipments',
  'verifyWebhook',
]);

export const disabledSupplierAdapter = Object.freeze({
  key: 'disabled',
  validateConnection: async () => ({ ok: false, status: 'DISABLED' }),
  quoteOrPriceCheck: disabled,
  submitOrder: disabled,
  getOrder: disabled,
  cancelOrder: disabled,
  listShipments: disabled,
  verifyWebhook: disabled,
});

export const manualExportAdapter = Object.freeze({
  key: 'manual_export',
  validateConnection: async () => ({ ok: true, status: 'MANUAL_HANDOFF' }),
  quoteOrPriceCheck: disabled,
  submitOrder: disabled,
  getOrder: disabled,
  cancelOrder: disabled,
  listShipments: disabled,
  verifyWebhook: disabled,
});

export function adapterFor(key) {
  return key === 'manual_export' ? manualExportAdapter : disabledSupplierAdapter;
}
