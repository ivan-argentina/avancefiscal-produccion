import { useNavigate } from "react-router-dom";
import UndoIcon from "@mui/icons-material/Undo";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useRef, useEffect, useState } from "react";
import { generarpdfU } from "../utils/generarpdfU";
import GenerarPdf from "../componentes/GenerarPdf";
import { DataGrid } from "@mui/x-data-grid";
import { Button } from "@mui/material";

import { supabase } from "../hook/supabaseClient";
import { obtenerEmpresa } from "../utils/obtenerEmpresa";
import Tooltip from "@mui/material/Tooltip";

import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [detalleFactura, setDetalleFactura] = useState([]);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [pdfData, setPdfData] = useState(null);
  const [pdfNombre, setPdfNombre] = useState("");

  const facturaPdfRef = useRef();

  const navigate = useNavigate();
  const crearNotaCredito = (factura) => {
    localStorage.setItem("notaCreditoOrigen", JSON.stringify(factura));

    navigate("/factura");
  };

  const autorizarFacturaPendiente = async (factura) => {
    const response = await fetch(
      "https://gestion-production-e3f6.up.railway.app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idFactura: factura.id,
        }),
      },
    );

    const data = await response.json();
    const detallePdf = data.fiscal.detalle.map((item, index) => ({
      id: index,
      articulo: item.descripcion,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.subtotal,
    }));

    if (!data.ok) {
      alert(data.mensaje || data.error || "Error al autorizar factura");
      return;
    }

    alert("Factura autorizada correctamente");

    await cargarFacturas();
  };

  const enviarWhatsAppFactura = async (factura) => {
    // Genera y descarga el PDF
    await descargarPdfFactura(factura);
    const telefono = factura.clientes?.telefono?.replace(/\D/g, "");

    if (!telefono) {
      alert("El cliente no tiene teléfono cargado");
      return;
    }

    const mensaje = `Hola ${factura.clientes?.nombre}, te enviamos la factura N° ${factura.numero_fiscal}.`;

    window.open(
      `https://wa.me/54${telefono}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
    );
  };

  const cargarFacturas = async () => {
    const usuarioGuardado = JSON.parse(localStorage.getItem("usuario"));
    if (!usuarioGuardado?.id) {
      console.log("No hay usuario logueado");
      return;
    }
    const idEmpresa = await obtenerEmpresa(usuarioGuardado.id);
    if (!idEmpresa) {
      console.log("No se encontró empresa para el usuario");
      return;
    }

    const { data, error } = await supabase
      .from("facturas")
      .select(
        `
    id,
    idcliente,
    idfactura_origen,
     numero_origen,
    numero,
    fecha,
    tipo_comprobante,
    letra_comprobante,
    forma_pago,
    observaciones,
    subtotal,
    total,
    punto_venta,
    estado_fiscal,
    numero_fiscal,
    cae,
    cae_vencimiento,
    afip_error_code,
    afip_error_msg,

    clientes (
      nombre,
      cuit,
      direccion,
      telefono,
      idciudad,
      ciudades(nombre)
    ),

    detalle_factura (
      id,
      idarticulo,
      cantidad,
      precio,
      subtotal,
      descripcion,
      articulos (
        descripcion
      )
    )
  `,
      )
      .eq("idempresa", idEmpresa)
      .order("id", { ascending: false });

    if (error) {
      console.log("Error al cargar facturas:", error);
      return;
    }

    setFacturas(data || []);
  };

  const verDetalleFactura = async (factura) => {
    const usuarioGuardado = JSON.parse(localStorage.getItem("usuario"));
    const idEmpresa = await obtenerEmpresa(usuarioGuardado.id);

    setFacturaSeleccionada(factura);
    const { data, error } = await supabase
      .from("factura_detalle")
      .select(
        `
        id,
        cantidad,
        precio,
        subtotal,
        articulos(nombre)
      `,
      )
      .eq("idfactura", factura.numero)
      .eq("idempresa", factura.idEmpresa);

    if (error) {
      console.log("Error al cargar detalle:", error);
      return;
    }

    const detalleFormateado = (data || []).map((item) => ({
      id: item.id,
      articulo: item?.articulos?.descripcion || item.descripcion || "-",
      descripcion: item?.articulos?.descripcion || item.descripcion || "-",
      nombre: item?.articulos?.descripcion || item.descripcion || "-",
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.subtotal,
    }));

    setDetalleFactura(detalleFormateado);
    setOpenDetalle(true);
  };

  const descargarPdfFactura = async (factura) => {
    const usuarioGuardado = JSON.parse(localStorage.getItem("usuario"));
    const idEmpresa = await obtenerEmpresa(usuarioGuardado.id);

    const { data: empresaData } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", idEmpresa)
      .single();

    const { data, error } = await supabase
      .from("detalle_factura")
      .select(
        `
      id,
      cantidad,
      precio,
      subtotal,
      descripcion,
      articulos(descripcion)
    `,
      )
      .eq("idfactura", factura.id)
      .eq("idempresa", idEmpresa);

    if (error) {
      console.log("Error al cargar detalle para PDF:", error);
      return;
    }

    const detalleFormateado = (data || []).map((item) => ({
      id: item.id,
      articulo: item?.articulos?.descripcion || item.descripcion || "-",
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.subtotal,
    }));

    setPdfData({
      empresa: empresaData,
      numeroFactura: factura.numero_fiscal,
      fecha: factura.fecha,
      tipoComprobante: factura.tipo_comprobante,
      letraComprobante: factura.letra_comprobante || "C",
      formaPago: factura.forma_pago,
      clienteSeleccionado: factura.clientes,
      detalle: detalleFormateado,
      totalFactura: factura.total,
      observaciones: factura.observaciones,
      puntoVenta: factura.punto_venta,
      cae: factura.cae,
      vencimientoCae: factura.cae_vencimiento,
      numeroOrigen: factura.numero_origen,
    });

    const nombreComprobante =
      factura.tipoComprobante === "nota_de_credito"
        ? "nota-credito"
        : "factura";

    setPdfNombre(
      `${nombreComprobante}-${factura.letra_comprobante || "C"}-${String(
        factura.punto_venta || 1,
      ).padStart(4, "0")}-${String(
        factura.numero_fiscal || factura.numero || 0,
      ).padStart(8, "0")}.pdf`,
    );
  };

  useEffect(() => {
    cargarFacturas();
  }, []);

  useEffect(() => {
    if (!pdfData || !pdfNombre) return;

    const timer = setTimeout(() => {
      generarpdfU(facturaPdfRef.current, pdfNombre);
      setPdfNombre("");
    }, 800);

    return () => clearTimeout(timer);
  }, [pdfData, pdfNombre]);

  const columnas = [
    {
      field: "fecha",
      headerName: "Fecha",
      width: 120,
      renderCell: (params) => {
        if (!params.value) return "-";

        const [anio, mes, dia] = params.value.split("-");

        return `${dia}/${mes}/${anio}`;
      },
    },
    {
      field: "tipo",
      headerName: "Tipo",
      width: 150,
      renderCell: (params) => {
        const tipo = params.row.tipo_comprobante || "";
        const letra = params.row.letra_comprobante || params.row.letra || "";

        if (tipo === "factura") return `Factura ${letra}`;
        if (tipo === "nota_de_credito") return `NC ${letra}`;
        if (tipo === "presupuesto") return "Presupuesto";
        if (tipo === "remito") return "Remito";

        return tipo;
      },
    },
    {
      field: "cliente",
      headerName: "Cliente",
      minWidth: 220,
      renderCell: (params) => params.row?.clientes?.nombre || "Sin Cliente",
    },
    {
      field: "total",
      headerName: "Total",
      flex: 1,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const valor = Number(params.row.total || 0);

        return `$ ${valor.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      },
    },
    {
      field: "estado_fiscal",
      headerName: "Estado Fiscal",
      width: 150,
      renderCell: (params) => {
        const estado = params.value || "pendiente";

        const config = {
          autorizada: {
            label: "Autorizada",
            color: "success",
          },
          pendiente: {
            label: "Pendiente",
            color: "warning",
          },
          rechazada: {
            label: "Rechazada",
            color: "error",
          },
        };

        const item = config[estado] || {
          label: estado,
          color: "default",
        };

        return <Chip label={item.label} color={item.color} size="small" />;
      },
    },
    {
      field: "numero_fiscal",
      headerName: "N° Fiscal",
      width: 160,
      renderCell: (params) => {
        const ptoVta = String(params.row.punto_venta || 1).padStart(4, "0");
        const nro = String(params.value || 0).padStart(8, "0");
        return `${ptoVta}-${nro}`;
      },
    },
    {
      field: "cae",
      headerName: "CAE",
      width: 160,
      renderCell: (params) => {
        if (params.row.estado_fiscal !== "autorizada") return "-";
        return params.value || "-";
      },
    },
    {
      field: "afip_error_code",
      headerName: "Error AFIP",
      width: 100,
      renderCell: (params) => {
        const code = params.row.afip_error_code;
        const msg = params.row.afip_error_msg;
        const estado = params.row.estado_fiscal;

        // Factura pendiente
        if (estado === "pendiente") {
          return (
            <Tooltip title="Comprobante aún no enviado a AFIP">
              <Chip
                label="Pend."
                color="warning"
                size="small"
                variant="outlined"
              />
            </Tooltip>
          );
        }

        // Factura autorizada sin errores
        if (!code) {
          return (
            <Tooltip title="Comprobante autorizado correctamente por AFIP">
              <Chip
                label="OK"
                color="success"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Tooltip>
          );
        }

        // Factura rechazada con error AFIP
        return (
          <Tooltip title={msg || "Error informado por AFIP"}>
            <Chip
              label={code}
              color="error"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
        );
      },
    },
    {
      field: "cae_vencimiento",
      headerName: "Vto. CAE",
      width: 120,
      renderCell: (params) => {
        if (!params.value) return "-";
        const fecha = new Date(params.value);
        return fecha.toLocaleDateString("es-AR");
      },
    },

    {
      field: "pdf",
      headerName: "Acciones",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <>
          <Tooltip title="Descargar PDF">
            <IconButton
              color="secondary"
              onClick={() => descargarPdfFactura(params.row)}
            >
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Enviar por WhatsApp">
            <IconButton
              color="success"
              onClick={() => enviarWhatsAppFactura(params.row)}
            >
              <WhatsAppIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Generar Nota de Credito">
            <IconButton
              color="warning"
              onClick={() => crearNotaCredito(params.row)}
            >
              <UndoIcon />
            </IconButton>
          </Tooltip>
        </>
      ),
    },

    {
      field: "autorizar",
      headerName: "AFIP",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        if (params.row.estado_fiscal === "autorizada") {
          return "-";
        }

        return (
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => autorizarFacturaPendiente(params.row)}
          >
            Autorizar
          </Button>
        );
      },
    },
  ];

  const facturasFiltradas = facturas.filter((f) => {
    const nombreCliente = f.clientes?.nombre || "";
    return nombreCliente.toLowerCase().includes(filtro.toLowerCase());
  });

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 3, width: "100%" }}>
        <Typography variant="h5" gutterBottom>
          Listado de Facturas
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            label="Buscar por cliente"
            size="small"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </Box>

        <Box sx={{ width: "100%", height: 450 }}>
          <DataGrid
            rows={facturasFiltradas}
            columns={columnas}
            pageSizeOptions={[5, 10, 20]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
            rowHeight={50}
            disableRowSelectionOnClick
            sx={{
              width: "100%",
              fontSize: 13,
              borderRadius: 2,
            }}
            localeText={{
              noRowsLabel: "No hay facturas cargadas",
            }}
          />
        </Box>
      </Paper>

      <Dialog
        open={openDetalle}
        onClose={() => setOpenDetalle(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle de Factura</DialogTitle>

        <DialogContent>
          {facturaSeleccionada && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Número:</strong> {facturaSeleccionada.numero || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Fecha:</strong> {facturaSeleccionada.fecha}
              </Typography>
              <Typography variant="body2">
                <strong>Cliente:</strong>{" "}
                {facturaSeleccionada?.clientes?.nombre || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Tipo:</strong> {facturaSeleccionada.tipo_comprobante}
              </Typography>
              <Typography variant="body2">
                <strong>Forma de pago:</strong> {facturaSeleccionada.forma_pago}
              </Typography>
              <Typography variant="body2">
                <strong>Total:</strong>{" "}
                {new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  minimumFractionDigits: 2,
                }).format(facturaSeleccionada.total || 0)}
              </Typography>
            </Box>
          )}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Artículo</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Precio</TableCell>
                <TableCell align="right">Subtotal</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {detalleFactura.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.articulos?.descripcion ||
                      item.articulo ||
                      item.nombre ||
                      item.descripcion ||
                      "-"}
                  </TableCell>
                  <TableCell align="right">{item.cantidad}</TableCell>
                  <TableCell align="right">
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      minimumFractionDigits: 2,
                    }).format(item.precio || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      minimumFractionDigits: 2,
                    }).format(item.subtotal || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {pdfData && (
        <GenerarPdf
          ref={facturaPdfRef}
          empresa={pdfData.empresa}
          fecha={pdfData.fecha}
          letraComprobante={pdfData.letraComprobante}
          tipoComprobante={pdfData.tipoComprobante}
          puntoVenta={pdfData.puntoVenta}
          numeroFactura={pdfData.numeroFactura}
          formaPago={pdfData.formaPago}
          clienteSeleccionado={pdfData.clienteSeleccionado}
          detalle={pdfData.detalle}
          totalFactura={pdfData.totalFactura}
          observaciones={pdfData.observaciones}
          cae={pdfData.cae}
          vencimientoCae={pdfData.vencimientoCae}
          numeroOrigen={pdfData.numeroOrigen}
        />
      )}
    </Box>
  );
}
