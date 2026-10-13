import { NextRequest, NextResponse } from "next/server";

// Cache in-memory untuk menyimpan hasil reverse geocode berdasarkan koordinat (~100m radius)
const geoCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Jam

function normalizeText(text?: string): string {
  if (!text) return "";
  return text.trim();
}

function cleanKecamatan(name: string): string {
  let clean = name.replace(/^(kecamatan|kec\.)\s+/i, "").trim();
  return clean ? `KEC. ${clean.toUpperCase()}` : "";
}

function cleanKabupaten(name: string, description?: string): string {
  let clean = name.replace(/^(kabupaten|kab\.|kota administrasi|kota adm\.|kota)\s+/i, "").trim().toUpperCase();
  const desc = (description || "").toLowerCase();
  const lowerName = name.toLowerCase();

  // Kasus DKI Jakarta
  if (clean.includes("JAKARTA") || clean === "KEPULAUAN SERIBU") {
    return clean;
  }

  // Jika terdeteksi kota
  if (desc.includes("kota") || lowerName.startsWith("kota")) {
    return `KOTA ${clean}`;
  }

  // Jika terdeteksi kabupaten
  if (desc.includes("kabupaten") || lowerName.startsWith("kabupaten") || lowerName.startsWith("kab.")) {
    return `KAB. ${clean}`;
  }

  // Default jika tidak ada prefix khusus
  return clean ? `KAB./KOTA ${clean}` : "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { success: false, error: "Parameter lat dan lng dibutuhkan" },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { success: false, error: "Koordinat lat atau lng tidak valid" },
      { status: 400 }
    );
  }

  // Key cache dibulatkan ke 3 desimal (~110m akurasi fisik)
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: cached.data });
  }

  let kecamatan = "";
  let kabupaten = "";
  let provinsi = "";

  // 1. Coba BigDataCloud API (sangat cepat & detail tingkat administrasi Indonesia)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
      {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      }
    );
    clearTimeout(timeoutId);

    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const adminList: any[] = bdcData.localityInfo?.administrative || [];

      // Level 6 di BDC biasanya Kecamatan
      const kecItem = adminList.find(
        (item) => item.adminLevel === 6 || item.description?.toLowerCase().includes("kecamatan")
      );
      // Level 5 di BDC biasanya Kota / Kabupaten
      const kabItem = adminList.find(
        (item) => item.adminLevel === 5 || item.description?.toLowerCase().includes("kota") || item.description?.toLowerCase().includes("kabupaten")
      );
      // Level 4 di BDC biasanya Provinsi
      const provItem = adminList.find(
        (item) => item.adminLevel === 4 || item.description?.toLowerCase().includes("provinsi")
      );

      const kecRaw = kecItem?.name || bdcData.locality || "";
      const kabRaw = kabItem?.name || bdcData.city || "";
      const provRaw = provItem?.name || bdcData.principalSubdivision || "";

      if (kecRaw) kecamatan = cleanKecamatan(kecRaw);
      if (kabRaw) kabupaten = cleanKabupaten(kabRaw, kabItem?.description);
      if (provRaw) provinsi = provRaw.toUpperCase();
    }
  } catch (err) {
    console.warn("BigDataCloud reverse geocode attempt failed, trying Nominatim fallback:", err);
  }

  // 2. Fallback ke OpenStreetMap Nominatim jika BigDataCloud belum mendapatkan data lengkap
  if (!kecamatan || !kabupaten) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "DCDevelopmentApp/1.0 (Alfamart Internal Development)",
            "Accept-Language": "id,en"
          }
        }
      );
      clearTimeout(timeoutId);

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const addr = nomData.address || {};

        const kecRaw =
          addr.subdistrict ||
          addr.city_district ||
          addr.district ||
          addr.town ||
          addr.municipality ||
          addr.village ||
          "";

        const kabRaw =
          addr.city ||
          addr.county ||
          addr.regency ||
          addr.state_district ||
          "";

        const provRaw = addr.state || "";

        if (!kecamatan && kecRaw) {
          kecamatan = cleanKecamatan(kecRaw);
        }
        if (!kabupaten && kabRaw) {
          // Jika di OpenStreetMap bertipe county dan tidak ada prefix, biasanya Kabupaten
          const isCounty = !!addr.county && !addr.city;
          kabupaten = cleanKabupaten(kabRaw, isCounty ? "kabupaten" : "kota");
        }
        if (!provinsi && provRaw) {
          provinsi = provRaw.toUpperCase();
        }
      }
    } catch (err) {
      console.warn("Nominatim reverse geocode fallback failed:", err);
    }
  }

  // Format teks gabungan
  let formattedText = "";
  if (kecamatan && kabupaten) {
    formattedText = `${kecamatan}, ${kabupaten}`;
  } else if (kecamatan) {
    formattedText = kecamatan;
  } else if (kabupaten) {
    formattedText = kabupaten;
  } else if (provinsi) {
    formattedText = provinsi;
  } else {
    formattedText = `LAT: ${lat.toFixed(6)}, LNG: ${lng.toFixed(6)}`;
  }

  const resultData = {
    kecamatan,
    kabupaten,
    provinsi,
    formattedText
  };

  // Simpan di cache
  geoCache.set(cacheKey, { data: resultData, timestamp: Date.now() });

  return NextResponse.json({
    success: true,
    data: resultData
  });
}
