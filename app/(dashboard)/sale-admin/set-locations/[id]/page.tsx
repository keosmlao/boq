"use client";

import { useParams,useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MapPicker from "@/_components/MapPicker";
import Swal from "sweetalert2";
import { getProject, updateProjectLocationsAction } from "@/_actions/projects";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


function SetProjectLocations() {
  const { id } = useParams(); // /sale-admin/set-locations/:id
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState(null);

  // ฟอร์มพิกัด
  const [office, setOffice] = useState({ lat: "", lng: "" });
  const [site, setSite] = useState({ lat: "", lng: "" });

  useEffect(() => {
    const run = async () => {
      try {
        const res: any = await getProject(String(id));
        const p = res?.data || {};
        setProject(p);
        setOffice({
          lat: p.office_lat ?? "",
          lng: p.office_lng ?? "",
        });
        setSite({
          lat: p.project_lat ?? "",
          lng: p.project_lng ?? "",
        });
      } catch (e) {
        console.error(e);
        Swal.fire("Error", "Cannot load project", "error")
          .then(() => router.push("/sale-admin/list-project"));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const toFixedStr = (n) =>
    typeof n === "number" ? n.toFixed(7) : (n || "");

  const save = async () => {
    setSaving(true);
    try {
      await updateProjectLocationsAction(String(id), {
        office_lat: toFixedStr(office.lat),
        office_lng: toFixedStr(office.lng),
        project_lat: toFixedStr(site.lat),
        project_lng: toFixedStr(site.lng),
      });
      Swal.fire("สำเร็จ", "อัปเดตพิกัดเรียบร้อย", "success")
        .then(() => router.push("/sale-admin/list-project"));
    } catch (e) {
      console.error(e);
      Swal.fire("ผิดพลาด", "บันทึกพิกัดไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">⚙️ ກຳນົດພິກັດໂຄງການ</h1>
        <button
          onClick={() => router.back()}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          ກັບ
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Office */}
        <section className="bg-white p-6 rounded-md shadow">
          <div className="font-semibold mb-2">🏢 Office Location</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input
              className="border px-3 py-2 rounded-lg"
              placeholder="Lat"
              value={office.lat}
              onChange={(e) => setOffice((s) => ({ ...s, lat: e.target.value.replace(/[^\d\.\-]/g, "") }))}
            />
            <input
              className="border px-3 py-2 rounded-lg"
              placeholder="Lng"
              value={office.lng}
              onChange={(e) => setOffice((s) => ({ ...s, lng: e.target.value.replace(/[^\d\.\-]/g, "") }))}
            />
            {office.lat && office.lng ? (
              <a
                href={`https://www.google.com/maps?q=${office.lat},${office.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="md:col-span-2 text-[var(--theme-primary)] underline flex items-center"
              >
                View in Google Maps
              </a>
            ) : <div className="md:col-span-2 text-gray-400 flex items-center">ຍັງບໍ່ກຳນົດ</div>}
          </div>

          <MapPicker
            value={{ lat: office.lat, lng: office.lng }}
            onChange={(p) => setOffice({ lat: p.lat.toFixed(7), lng: p.lng.toFixed(7) })}
            placeholder="Search office…"
          />
        </section>

        {/* Project */}
        <section className="bg-white p-6 rounded-md shadow">
          <div className="font-semibold mb-2">📍 Project Location</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input
              className="border px-3 py-2 rounded-lg"
              placeholder="Lat"
              value={site.lat}
              onChange={(e) => setSite((s) => ({ ...s, lat: e.target.value.replace(/[^\d\.\-]/g, "") }))}
            />
            <input
              className="border px-3 py-2 rounded-lg"
              placeholder="Lng"
              value={site.lng}
              onChange={(e) => setSite((s) => ({ ...s, lng: e.target.value.replace(/[^\d\.\-]/g, "") }))}
            />
            {site.lat && site.lng ? (
              <a
                href={`https://www.google.com/maps?q=${site.lat},${site.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="md:col-span-2 text-[var(--theme-primary)] underline flex items-center"
              >
                View in Google Maps
              </a>
            ) : <div className="md:col-span-2 text-gray-400 flex items-center">ຍັງບໍ່ກຳນົດ</div>}
          </div>

          <MapPicker
            value={{ lat: site.lat, lng: site.lng }}
            onChange={(p) => setSite({ lat: p.lat.toFixed(7), lng: p.lng.toFixed(7) })}
            placeholder="Search project…"
          />
        </section>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className={`px-6 py-3 rounded-lg text-white font-semibold ${saving ? "bg-gray-400" : "bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-strong)]"}`}
          >
            {saving ? "Saving…" : "Save Locations"}
          </button>
        </div>
      </div>
    </>
  );
}

export { SetProjectLocations as default };
