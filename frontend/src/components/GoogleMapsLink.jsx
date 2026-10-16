/**
 * Google Maps link card for a business address, shown after a booking is
 * confirmed. Renders nothing when no address is provided.
 * @param {{ address?: string }} props
 */
export default function GoogleMapsLink({ address }) {
  if (!address) return null;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-800">📍 Ubicación del negocio</p>
      <p className="mt-1 text-sm text-blue-600">{address}</p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Cómo llegar
      </a>
    </div>
  );
}
