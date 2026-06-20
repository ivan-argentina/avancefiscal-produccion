import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  LinearProgress,
} from "@mui/material";
import { supabase } from "../hook/supabaseClient";
import { obtenerEmpresa } from "../utils/obtenerEmpresa";

const API_URL = "https://gestion-production-e3f6.up.railway.app";

export default function Dashboard() {
  const [certificado, setCertificado] = useState(null);
  const [resumen, setResumen] = useState({
    ventasMes: 0,
    saldoCobrar: 0,
    comprobantesMes: 0,
  });
  const [monotributo, setMonotributo] = useState({
    condicionIva: "",
    categoria: "",
    limite: 0,
    facturado12Meses: 0,
    disponible: 0,
    porcentaje: 0,
  });

  const cargarResumen = async () => {
    const usuarioGuardado = JSON.parse(localStorage.getItem("usuario"));
    const idEmpresa = await obtenerEmpresa(usuarioGuardado.id);

    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      .toISOString()
      .slice(0, 10);

    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from("facturas")
      .select("total, saldo, estado_fiscal, fecha")
      .eq("idempresa", idEmpresa)
      .gte("fecha", desde)
      .lte("fecha", hasta);

    if (error) {
      console.log("Error resumen:", error);
      return;
    }

    const ventasMes = (data || [])
      .filter((f) => f.estado_fiscal === "autorizada")
      .reduce((acc, f) => acc + Number(f.total || 0), 0);

    const comprobantesMes = (data || []).filter(
      (f) => f.estado_fiscal === "autorizada",
    ).length;

    const { data: pendientes } = await supabase
      .from("facturas")
      .select("saldo")
      .eq("idempresa", idEmpresa)
      .gt("saldo", 0);

    const saldoCobrar = (pendientes || []).reduce(
      (acc, f) => acc + Number(f.saldo || 0),
      0,
    );

    setResumen({
      ventasMes,
      saldoCobrar,
      comprobantesMes,
    });
  };
  const cargarMonotributo = async () => {
    const usuarioGuardado = JSON.parse(localStorage.getItem("usuario"));
    const idEmpresa = await obtenerEmpresa(usuarioGuardado.id);

    const { data: empresa, error: errorEmpresa } = await supabase
      .from("empresas")
      .select("condicion_iva, categoria_monotributo")
      .eq("id", idEmpresa)
      .maybeSingle();

    if (errorEmpresa) {
      console.log("Error empresa monotributo:", errorEmpresa);
      return;
    }

    if (empresa?.condicion_iva !== "Monotributista") {
      return;
    }

    const { data: categoria, error: errorCategoria } = await supabase
      .from("categorias_monotributo")
      .select("limite_facturacion")
      .eq("categoria", empresa.categoria_monotributo?.trim().toUpperCase())
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("categorias_monotributo")
      .select("*");

    if (errorCategoria) {
      console.log("Error categoría monotributo:", errorCategoria);
      return;
    }

    const hoy = new Date();
    const desde12Meses = new Date(hoy);
    desde12Meses.setFullYear(hoy.getFullYear() - 1);

    const desde = desde12Meses.toISOString().slice(0, 10);
    const hasta = hoy.toISOString().slice(0, 10);

    const { data: facturas, error: errorFacturas } = await supabase
      .from("facturas")
      .select("total, tipo_comprobante, estado_fiscal, fecha")
      .eq("idempresa", idEmpresa)
      .eq("estado_fiscal", "autorizada")
      .gte("fecha", desde)
      .lte("fecha", hasta);

    if (errorFacturas) {
      console.log("Error facturas monotributo:", errorFacturas);
      return;
    }

    const facturado12Meses = (facturas || []).reduce((acc, f) => {
      const total = Number(f.total || 0);

      if (f.tipo_comprobante === "nota_de_credito") {
        return acc - total;
      }

      return acc + total;
    }, 0);

    const limite = Number(categoria?.limite_facturacion || 0);
    const porcentaje = limite ? (facturado12Meses / limite) * 100 : 0;
    const disponible = limite - facturado12Meses;

    setMonotributo({
      condicionIva: empresa.condicion_iva,
      categoria: empresa.categoria_monotributo,
      limite,
      facturado12Meses,
      disponible,
      porcentaje,
    });
  };

  const cargarEstadoCertificado = async () => {
    try {
      const res = await fetch(`${API_URL}/api/fiscal/certificado/estado`);
      const data = await res.json();

      if (data.ok) {
        setCertificado(data);
      }
    } catch (error) {
      console.log("Error certificado:", error);
    }
  };

  useEffect(() => {
    cargarEstadoCertificado();
    cargarResumen();
    cargarMonotributo();
  }, []);

  const configCertificado = {
    vigente: {
      label: "Certificado vigente",
      color: "success",
    },
    por_vencer: {
      label: "Certificado por vencer",
      color: "warning",
    },
    vencido: {
      label: "Certificado vencido",
      color: "error",
    },
  };

  const estadoCert = certificado?.estado || "vigente";
  const config = configCertificado[estadoCert];

  console.log("MONOTRIBUTO:", monotributo);
  console.log("CONDICION IVA:", monotributo.condicionIva);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Ventas del mes
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {resumen.ventasMes.toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Saldo a cobrar
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {resumen.saldoCobrar.toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Comprobantes del mes
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {resumen.comprobantesMes}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Estado AFIP
              </Typography>

              <Box sx={{ mt: 1, mb: 1 }}>
                <Chip
                  label={config.label}
                  color={config.color}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              <Typography variant="body2">
                Vence:{" "}
                {certificado?.vence
                  ? new Date(certificado.vence).toLocaleDateString("es-AR")
                  : "-"}
              </Typography>

              <Typography variant="body2">
                Días restantes: {certificado?.diasRestantes ?? "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {monotributo.condicionIva === "Monotributista" && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Control Monotributo
                </Typography>

                <Typography variant="h6" fontWeight="bold">
                  Categoría {monotributo.categoria || "-"}
                </Typography>

                <Box sx={{ mt: 1, mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(monotributo.porcentaje, 100)}
                    color={
                      monotributo.porcentaje >= 90
                        ? "error"
                        : monotributo.porcentaje >= 70
                          ? "warning"
                          : "success"
                    }
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>

                <Typography variant="body2">
                  Usado: {monotributo.porcentaje.toFixed(2)}%
                </Typography>

                <Typography variant="body2">
                  Facturado 12 meses:{" "}
                  {monotributo.facturado12Meses.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </Typography>

                <Typography variant="body2">
                  Límite:{" "}
                  {monotributo.limite.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </Typography>

                <Typography variant="body2">
                  Disponible:{" "}
                  {monotributo.disponible.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
