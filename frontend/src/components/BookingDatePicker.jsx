function toDateStr(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BookingDatePicker({
  selectedDateStr,
  onChange,
  minDate,
  maxDate,
}) {
  const minStr = minDate ? toDateStr(minDate) : '';
  const maxStr = maxDate ? toDateStr(maxDate) : '';

  const handleChange = (e) => {
    const v = e.target.value;
    if (!v) {
      onChange(null, '');
      return;
    }
    const d = new Date(v + 'T12:00:00');
    onChange(d, v);
  };

  return (
    <input
      type="date"
      value={selectedDateStr}
      onChange={handleChange}
      min={minStr}
      max={maxStr}
      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm transition-colors duration-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 hover:border-gray-400"
    />
  );
}
