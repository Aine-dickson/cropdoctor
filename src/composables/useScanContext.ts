export interface ScanContext {
    latitude?: number
    longitude?: number
    datetime: string
}

export class LocationPermissionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'LocationPermissionError'
    }
}

export async function getScanContext(): Promise<ScanContext> {
    const datetime = new Date().toISOString()

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return { datetime }
    }

    const position = await new Promise<GeolocationPosition | null>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (result) => resolve(result),
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    reject(new LocationPermissionError('Location permission is blocked. Allow location access in the browser prompt or settings, then tap Analyse crop again.'))
                    return
                }

                resolve(null)
            },
            {
                enableHighAccuracy: false,
                timeout: 4000,
                maximumAge: 5 * 60 * 1000,
            },
        )
    })

    if (!position) {
        return { datetime }
    }

    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        datetime,
    }
}
