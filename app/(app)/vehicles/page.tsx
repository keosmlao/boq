/**
 * ລົດຊ່າງ — SERVER component. First page + the technician list for the assign
 * dialog are rendered here; later search / tab / sort / page changes call
 * getVehiclesPage() and return one page.
 */
import { getVehiclesPage, getTechniciansForAssign } from "@/_actions/vehicles";
import VehiclesClient from "./VehiclesClient";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const [list, techs] = await Promise.all([
    getVehiclesPage({ page: 1, sort: "plate_no", dir: "asc" }),
    getTechniciansForAssign(),
  ]);
  return (
    <VehiclesClient
      initial={list.success ? list.data : null}
      initialTechnicians={techs.success ? techs.data : []}
      loadError={list.success ? "" : (list as { message: string }).message}
    />
  );
}
