"use client";

import { MapPin as FiMapPin } from "lucide-react";
import { useState } from "react";

export default function SetLocations() {
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [projectLat, setProjectLat] = useState("");
  const [projectLng, setProjectLng] = useState("");

  return (
      <>
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-md shadow-[var(--theme-shadow)] mt-8">
        <h1 className="text-2xl font-bold mb-6 text-[var(--theme-primary)]">ກຳນົດແຜນທີ່ຫ້ອງການ ແລະ ໂຄງການ</h1>
        <form className="space-y-8">
          {/* Office Map */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FiMapPin className="inline-block mr-1 text-gray-500" /> ແຜນທີ່ຫ້ອງການ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={officeLat}
                onChange={e => setOfficeLat(e.target.value)}
                className="w-1/2 border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] placeholder-gray-400"
                placeholder="Latitude"
              />
              <input
                type="text"
                value={officeLng}
                onChange={e => setOfficeLng(e.target.value)}
                className="w-1/2 border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] placeholder-gray-400"
                placeholder="Longitude"
              />
            </div>
            {officeLat && officeLng && (
              <a
                href={`https://www.google.com/maps?q=${officeLat},${officeLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--theme-primary)] underline mt-2 inline-block"
              >
                ເບິ່ງແຜນທີ່ຫ້ອງການ
              </a>
            )}
          </div>

          {/* Project Map */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FiMapPin className="inline-block mr-1 text-gray-500" /> ແຜນທີ່ໂຄງການ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectLat}
                onChange={e => setProjectLat(e.target.value)}
                className="w-1/2 border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] placeholder-gray-400"
                placeholder="Latitude"
              />
              <input
                type="text"
                value={projectLng}
                onChange={e => setProjectLng(e.target.value)}
                className="w-1/2 border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] placeholder-gray-400"
                placeholder="Longitude"
              />
            </div>
            {projectLat && projectLng && (
              <a
                href={`https://www.google.com/maps?q=${projectLat},${projectLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--theme-primary)] underline mt-2 inline-block"
              >
                ເບິ່ງແຜນທີ່ໂຄງການ
              </a>
            )}
          </div>
        </form>
      </div>
      </>
  );
}
