import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BusinessConfig, Family, Product, ProductHistory, ProductNote } from "./mdvd";

export const businessConfigQuery = () =>
  queryOptions({
    queryKey: ["business-config"],
    queryFn: async (): Promise<BusinessConfig> => {
      const { data, error } = await supabase
        .from("business_config")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        id: 1,
        monthly_cost: 200000,
        monthly_revenue: 175000,
        overhead_factor: 2,
      }) as unknown as BusinessConfig;
    },
  });


export const productHistoryQuery = (productId: string) =>
  queryOptions({
    queryKey: ["product-history", productId],
    queryFn: async (): Promise<ProductHistory[]> => {
      const { data, error } = await supabase
        .from("product_history")
        .select("*")
        .eq("product_id", productId)
        .order("changed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ProductHistory[];
    },
  });

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const all: Product[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("family", { ascending: true })
          .order("name", { ascending: true })
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as Product[]));
        if (!data || data.length < page) break;
      }
      return all;
    },
  });

export const familiesQuery = () =>
  queryOptions({
    queryKey: ["families"],
    queryFn: async (): Promise<Family[]> => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .order("items_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Family[];
    },
  });

export const productNotesQuery = () =>
  queryOptions({
    queryKey: ["product-notes"],
    queryFn: async (): Promise<ProductNote[]> => {
      const all: ProductNote[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("product_notes")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as ProductNote[]));
        if (!data || data.length < page) break;
      }
      return all;
    },
  });
