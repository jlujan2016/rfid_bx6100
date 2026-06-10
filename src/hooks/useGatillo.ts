import { useEffect, useRef } from "react"

export function useGatillo(onPresionado: () => void) {
  const fnRef = useRef(onPresionado)

  // Mantiene la función actualizada sin re-registrar
  useEffect(() => {
    fnRef.current = onPresionado
  })

  useEffect(() => {
    let ultimoDisparo = 0

    ;(window as any).__onGatilloDown = () => {
      const ahora = Date.now()
      if (ahora - ultimoDisparo < 500) return  // debounce 500ms
      ultimoDisparo = ahora
      fnRef.current()
    }

    return () => {
      delete (window as any).__onGatilloDown
    }
  }, [])
}