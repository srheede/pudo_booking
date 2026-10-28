/**
 * PUDO rejects a shipment when the prepaid account cannot cover the quoted
 * rate. Door services cost more than locker services, so a balance that still
 * allows locker bookings fails only to-door bookings.
 */

export function isBalanceError(message) {
  return /amount exceeds balance|not enough balance|zero_balance|amount_exceed/i.test(
    String(message || "")
  );
}

export function explainBookingFailure(error, { rate, serviceCode } = {}) {
  const raw = error?.message || "Booking failed";
  if (!isBalanceError(raw) && error?.pudoType !== "amount_exceed" && error?.pudoType !== "zero_balance") {
    return raw;
  }
  const quoted = rate || error?.rate;
  const code = serviceCode || error?.serviceCode;
  const price =
    quoted && code
      ? ` This ${code} shipment is quoted at R${quoted}.`
      : quoted
        ? ` The quote is R${quoted}.`
        : "";
  const pudoText = raw.replace(/^Error invoking remote method '[^']+':\s*/i, "").replace(/^Error:\s*/i, "");
  return (
    `PUDO refused the booking because the PUDO account balance is too low (${pudoText}).${price} ` +
    "Door deliveries cost more than locker deliveries, so locker bookings can still succeed while a to-door booking is rejected. " +
    "Top up the balance in the PUDO / Courier Guy portal. Installing another copy of this app will not change it."
  );
}
