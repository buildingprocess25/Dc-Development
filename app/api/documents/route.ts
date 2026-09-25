import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let documents = [];
        if (projectId) {
            documents = await prisma.dc_document.findMany({
                where: {
                    project_id: parseInt(projectId)
                },
                // Wait, need to check if dc_document_version is available via relations.
                // Assuming standard naming by Prisma:
                include: {
                    dc_document_version: true
                }
            });
        } else {
            documents = await prisma.dc_document.findMany({
                include: {
                    dc_document_version: true
                }
            });
        }

        return NextResponse.json({ status: 'success', data: documents });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
