/**
 * Utility Geolocation & Jarak GPS untuk Absensi Aanwijzing DC-Development
 * Menggunakan Formula Haversine untuk kalkulasi jarak geodesik dalam meter.
 */

/**
 * Menghitung jarak garis lurus antara dua titik koordinat GPS (latitude, longitude)
 * Mengembalikan jarak dalam satuan meter (dibulatkan ke 1 desimal).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371e3; // Radius bumi rata-rata dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Format jarak meter untuk tampilan UI yang rapi dan mudah dibaca
 * Contoh: 45m atau 1.2 km
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || isNaN(meters)) {
    return "-";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Memeriksa apakah koordinat GPS valid
 */
export function isValidCoordinate(lat?: number | null, long?: number | null): boolean {
  if (lat === null || lat === undefined || long === null || long === undefined) return false;
  return !isNaN(lat) && !isNaN(long) && lat >= -90 && lat <= 90 && long >= -180 && long <= 180;
}

/**
 * Reverse geocoding koordinat GPS ke Kecamatan, Kabupaten/Kota, dan Provinsi
 * Menggunakan OpenStreetMap Nominatim dengan formatting wilayah Indonesia
 */
export async function reverseGeocodeCoords(
  lat: number,
  long: number
): Promise<{ kecamatan: string; kabupatenKota: string; provinsi: string; fullAddress: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'id,en',
          'User-Agent': 'SPARTA-DC-Development/1.0 (internal-attendance)',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Di Indonesia: city_district / district adalah Kecamatan
      const kec =
        addr.city_district ||
        addr.district ||
        addr.town ||
        addr.suburb ||
        addr.municipality ||
        addr.village ||
        '';

      // Kabupaten atau Kota
      const kab =
        addr.city ||
        addr.county ||
        addr.regency ||
        addr.region ||
        addr.state_district ||
        '';

      const prov = addr.state || '';

      const formattedKec = kec
        ? kec.toLowerCase().startsWith('kec')
          ? kec
          : `Kec. ${kec}`
        : '';

      const formattedKabName = kab
        ? kab.toLowerCase().startsWith('kab') || kab.toLowerCase().startsWith('kota')
          ? kab
          : (addr.city ? `Kota ${kab}` : `Kab. ${kab}`)
        : '';

      const fullKabWithProv = formattedKabName
        ? prov && !formattedKabName.toLowerCase().includes(prov.toLowerCase())
          ? `${formattedKabName}, ${prov}`
          : formattedKabName
        : prov;

      const parts: string[] = [];
      if (formattedKec) parts.push(formattedKec);
      if (fullKabWithProv) parts.push(fullKabWithProv);

      const formatted = parts.length > 0 ? parts.join(', ') : data.display_name || '';

      return {
        kecamatan: formattedKec,
        kabupatenKota: fullKabWithProv,
        provinsi: prov,
        fullAddress: formatted || `${lat.toFixed(5)}, ${long.toFixed(5)}`,
      };
    }
  } catch (err) {
    console.warn('Gagal reverse geocode koordinat:', err);
  }

  return {
    kecamatan: '',
    kabupatenKota: '',
    provinsi: '',
    fullAddress: `${lat.toFixed(5)}, ${long.toFixed(5)}`,
  };
}

/**
 * Mendapatkan perkiraan lokasi via IP publik jika browser GPS desktop timeout/tidak tersedia
 */
export async function getIpLocationFallback(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  region: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const d = await res.json();
      if (d.success !== false && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return {
          latitude: d.latitude,
          longitude: d.longitude,
          city: d.city || '',
          region: d.region || '',
        };
      }
    }
  } catch (err) {
    console.warn('Gagal IP fallback geolocation:', err);
  }
  return null;
}

/**
 * Memvalidasi apakah waktu saat ini sesuai dengan tanggal_pelaksanaan rapat Aanwijzing
 * Mengembalikan status:
 * - HARI_H: Tanggal hari ini sama persis dengan tanggal pelaksanaan
 * - BELUM_WAKTUNYA: Tanggal hari ini lebih awal dari tanggal pelaksanaan
 * - SUDAH_LEWAT: Tanggal pelaksanaan telah terlewati
 */
export function checkTanggalPelaksanaanHariH(targetDateInput?: string | Date | null): {
  isHariH: boolean;
  status: 'HARI_H' | 'BELUM_WAKTUNYA' | 'SUDAH_LEWAT' | 'INVALID';
  formattedTargetDate: string;
  message: string;
} {
  if (!targetDateInput) {
    return {
      isHariH: false,
      status: 'INVALID',
      formattedTargetDate: '-',
      message: 'Tanggal pelaksanaan rapat belum ditentukan.',
    };
  }

  const targetDate = new Date(targetDateInput);
  if (isNaN(targetDate.getTime())) {
    return {
      isHariH: false,
      status: 'INVALID',
      formattedTargetDate: '-',
      message: 'Format tanggal pelaksanaan rapat tidak valid.',
    };
  }

  const formatYMD = (d: Date) => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
    } catch {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  const today = new Date();
  const todayYMD = formatYMD(today);
  const targetYMD = formatYMD(targetDate);

  const formattedTargetDate = targetDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (todayYMD === targetYMD) {
    return {
      isHariH: true,
      status: 'HARI_H',
      formattedTargetDate,
      message: `Hari ini adalah Hari-H pelaksanaan rapat Aanwijzing (${formattedTargetDate}).`,
    };
  } else if (todayYMD < targetYMD) {
    return {
      isHariH: false,
      status: 'BELUM_WAKTUNYA',
      formattedTargetDate,
      message: `Sesi absensi kehadiran belum dapat dibuka. Rapat Aanwijzing dijadwalkan pada ${formattedTargetDate} (belum masuk Hari-H pelaksanaan).`,
    };
  } else {
    return {
      isHariH: false,
      status: 'SUDAH_LEWAT',
      formattedTargetDate,
      message: `Sesi absensi kehadiran tidak dapat dibuka karena jadwal rapat Aanwijzing telah lewat pada ${formattedTargetDate}.`,
    };
  }
}
