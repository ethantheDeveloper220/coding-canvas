import * as fs from 'fs'
import * as path from 'path'

/**
 * Check if a file is binary by analyzing its content
 * This is more reliable than just checking extension
 */
export function isFileBinaryByContent(filePath: string): boolean {
    try {
        // Read first few bytes to check for binary content
        const fileDescriptor = fs.openSync(filePath, 'r')
        const buffer = Buffer.alloc(512)
        const bytesRead = fs.readSync(fileDescriptor, buffer, 0, 512, 0)
        fs.closeSync(fileDescriptor)
        
        // Check for null bytes (common in binary files)
        if (buffer.includes(0)) {
            return true
        }
        
        // Check ratio of non-printable characters
        let nonPrintableCount = 0
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i]
            // Non-printable ASCII range (except for common whitespace like \t, \n, \r)
            if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                nonPrintableCount++
            }
        }
        
        // If more than 30% non-printable, likely binary
        const ratio = nonPrintableCount / bytesRead
        return ratio > 0.3
    } catch (error) {
        // If we can't read the file, assume binary
        console.log(`[OpenCodeDiff] Error checking file content, assuming binary: ${filePath}`, error)
        return true
    }
}