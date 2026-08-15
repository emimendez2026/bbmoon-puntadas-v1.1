# Instalacion / migracion a BBMOON v1.3

## Antes de empezar

1. Hacer una copia de seguridad de la planilla actual desde Google Sheets.
2. Conservar la implementacion actual de Apps Script hasta verificar la nueva version.
3. No borrar ninguna hoja existente.

## 1. Actualizar Apps Script

En el proyecto de Apps Script, reemplazar `Codigo.gs` y crear/copiar tambien `Datos.gs`, `Operaciones.gs` y `Gestion.gs` usando los cuatro archivos de la carpeta `backend/`. Mantener `Insumos_Iniciales.gs` si ya existe. Apps Script comparte el mismo espacio global entre todos los archivos `.gs`.

En el editor de Apps Script ejecutar manualmente:

```text
migrarV13()
```

La funcion crea las hojas nuevas y agrega columnas faltantes a las hojas existentes. No elimina filas actuales.

Nuevas hojas:

- Movimientos_Caja
- Movimientos_Stock
- Medidas_Clientes
- Agenda
- Auditoria

## 2. Crear el PIN de acceso

Ejecutar manualmente:

```text
configurarAcceso()
```

Abrir el registro de ejecucion. Se mostrara una unica vez un PIN numerico de 8 digitos.

El PIN no se guarda en la planilla. Apps Script conserva solamente un hash SHA-256 con salt en Script Properties.

Si alguna vez hay que invalidarlo, ejecutar:

```text
rotarPinAcceso()
```

Rotar el PIN tambien revoca todas las sesiones activas.

## 3. Volver a implementar el Web App

Crear/actualizar la implementacion web para que ejecute como el propietario de la planilla. Si se mantiene acceso publico al endpoint, los datos igualmente quedan bloqueados por el inicio de sesion de la aplicacion.

Copiar la URL terminada en `/exec`.

## 4. Publicar el frontend

Publicar la carpeta `frontend/` o usar el `index.html` de la raiz, que redirige automaticamente a `frontend/index.html`.

Al abrir la app:

1. Pegar la URL `/exec`.
2. Ingresar el PIN de 8 digitos.
3. Elegir si se desea recordar la sesion en ese dispositivo.

El PIN se envia solamente durante el inicio de sesion. Luego el navegador utiliza un token revocable con vencimiento de 30 dias.

## 5. Verificaciones recomendadas

Crear datos de prueba y comprobar:

1. Nuevo presupuesto con materiales y horas estimadas.
2. Cambio a estado Aprobado.
3. Conversion a trabajo con sena y medio de pago.
4. Comprobar que la sena aparezca en Pagos y Caja.
5. Comprobar el movimiento automatico de stock.
6. Registrar un pago parcial y anularlo.
7. Crear una ficha de medidas.
8. Crear un evento de agenda.
9. Descargar un respaldo JSON.

## Configuracion importante

En Configuracion se puede definir IVA, mano de obra por defecto, dias de validez, costo interno por hora, descuento automatico de stock y si se permite stock negativo. Se recomienda dejar **stock negativo desactivado**.
