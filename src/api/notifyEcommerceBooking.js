/**
 * Tell Gengar ecommerce a booking was just created so it can copy the
 * waybill onto matching unshipped seller / store parcels.
 *
 * Failures are logged and ignored — the booking itself already succeeded.
 */
import { auth } from "../firebase/config";
import { crashlytics } from "../firebase/crashlytics";
import config from "../../config.json";

export const GENGAR_BOOKING_WEBHOOK_URL =
  "https://ecommerce-backend-wpzvfp2i7q-ey.a.run.app/api/gengar_games/pudo-booking/booking-created/";

export async function notifyEcommerceBookingCreated(booking) {
  const url = String(
    config.ECOMMERCE_BOOKING_URL || GENGAR_BOOKING_WEBHOOK_URL
  ).trim();
  if (!url) return;

  const user = auth.currentUser;
  if (!user) return;

  let token;
  try {
    token = await user.getIdToken();
  } catch (err) {
    crashlytics.recordError(err, { source: "ecommerce-booking-notify-token" });
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({
        customerEmail: booking.customerEmail || "",
        customerId: booking.customerId || "",
        pudoRef: booking.pudoRef || "",
        shipmentData: booking.shipmentData || {},
      }),
    });
    if (!res.ok) {
      crashlytics.recordError(new Error(`ecommerce booking notify ${res.status}`), {
        source: "ecommerce-booking-notify",
      });
    }
  } catch (err) {
    crashlytics.recordError(err, { source: "ecommerce-booking-notify" });
  }
}
