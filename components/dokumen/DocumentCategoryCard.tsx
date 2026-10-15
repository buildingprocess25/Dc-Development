"use client";

import React from "react";
import HubCategoryCard, { HubCategoryCardProps } from "@/components/hub/HubCategoryCard";

export interface DocumentCategoryCardProps extends HubCategoryCardProps {
  id?: string;
}

export default function DocumentCategoryCard(props: DocumentCategoryCardProps) {
  return <HubCategoryCard {...props} />;
}
