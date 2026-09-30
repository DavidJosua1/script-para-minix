#!/bin/sh
# monitor.sh - Muestra el comportamiento de hardware y software en MINIX 3
# Uso:  sh monitor.sh          -> un solo reporte
#       sh monitor.sh 5        -> se actualiza cada 5 segundos (Ctrl+C para salir)
#       sh monitor.sh > r.txt  -> guarda el reporte en un archivo

INTERVALO=${1:-0}

seccion() {
    echo
    echo "=============================================="
    echo "  $1"
    echo "=============================================="
}

# Muestra un archivo si existe
mostrar_archivo() {
    if [ -r "$1" ]; then
        cat "$1"
    else
        echo "(no disponible: $1)"
    fi
}

# Ejecuta un comando; si falla, avisa
ejecutar() {
    "$@" 2>/dev/null || echo "(no disponible: $*)"
}

reporte() {
    echo "REPORTE DE SISTEMA - $(date)"

    seccion "SISTEMA OPERATIVO"
    ejecutar uname -a
    echo "Host: $(hostname 2>/dev/null)"
    ejecutar uptime

    seccion "HARDWARE: CPU"
    mostrar_archivo /proc/cpuinfo
    echo "--- Carga del sistema (loadavg) ---"
    mostrar_archivo /proc/loadavg

    seccion "HARDWARE: MEMORIA RAM"
    mostrar_archivo /proc/meminfo

    seccion "HARDWARE: DISCO"
    echo "--- Uso de particiones ---"
    ejecutar df
    echo "--- Sistemas de archivos montados ---"
    ejecutar mount
    echo "--- Dispositivos de disco ---"
    ls /dev/c0* 2>/dev/null || echo "(sin dispositivos c0*)"

    seccion "HARDWARE: PCI / GPU / DISPOSITIVOS"
    if [ -r /proc/pci ]; then
        cat /proc/pci
        echo "--- Coincidencias con video/VGA ---"
        grep -i -E "vga|video|display|graphic" /proc/pci || echo "(no se detecto GPU dedicada)"
    else
        echo "(no disponible: /proc/pci)"
    fi

    seccion "HARDWARE: RED"
    ejecutar ifconfig -a

    seccion "SOFTWARE: PROCESOS"
    TOTAL=$(ps -ax 2>/dev/null | wc -l)
    echo "Total de procesos (aprox.): $TOTAL"
    echo "--- Lista de procesos ---"
    ps -ax 2>/dev/null || ps

    seccion "SOFTWARE: SERVICIOS DEL SISTEMA (servers y drivers)"
    ls /service 2>/dev/null || ls /usr/sbin 2>/dev/null | head -30

    seccion "SOFTWARE: PAQUETES INSTALADOS"
    if command -v pkg_info >/dev/null 2>&1; then
        pkg_info 2>/dev/null | head -30
    else
        echo "(pkg_info no disponible)"
    fi

    seccion "SOFTWARE: CONSUMO DE RECURSOS POR PROCESO"
    # No se usa top: es interactivo y borra la pantalla al terminar
    ps -axl 2>/dev/null || ps -ax 2>/dev/null || echo "(ps no disponible)"
}

if [ "$INTERVALO" -gt 0 ] 2>/dev/null; then
    while :; do
        clear
        reporte
        sleep "$INTERVALO"
    done
else
    reporte
fi