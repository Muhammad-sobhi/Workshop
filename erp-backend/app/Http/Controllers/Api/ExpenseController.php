<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::with(['client', 'supplier']);

        if ($request->filled('start_date')) {
            $query->whereDate('expense_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('expense_date', '<=', $request->query('end_date'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        $query->orderBy('expense_date', 'desc')->orderBy('id', 'desc');

        $perPage = (int) $request->query('per_page', 20);
        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->transform(function ($e) {
            return [
                'id' => $e->id,
                'type' => 'expense',
                'expense_number' => $e->expense_number,
                'amount' => (float)$e->amount,
                'expense_date' => $e->expense_date,
                'category' => $e->category,
                'description' => $e->description,
                'reference_number' => $e->reference_number,
                'payment_method' => $e->payment_method,
                'client_name' => $e->client->name ?? '',
                'supplier_name' => $e->supplier->name ?? '',
                'receipt_path' => $e->receipt_path,
            ];
        });

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'category' => 'required|string|max:255',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'client_id' => 'nullable|exists:clients,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            $expNo = Expense::generateNextExpenseNumber();
            $payMethod = $validated['payment_method'] ?? 'cash';
            $amount = (float)$validated['amount'];

            $expense = Expense::create([
                'expense_number' => $expNo,
                'amount' => $amount,
                'expense_date' => $validated['expense_date'],
                'category' => $validated['category'],
                'description' => $validated['description'],
                'reference_number' => $validated['reference_number'] ?? null,
                'payment_method' => $payMethod,
                'client_id' => $validated['client_id'] ?? null,
                'supplier_id' => $validated['supplier_id'] ?? null,
                'receipt_path' => $receiptPath,
            ]);

            // Record Treasury Outflow
            TreasuryService::recordOutflow(
                amount: $amount,
                paymentMethod: $payMethod,
                category: $validated['category'],
                description: $validated['description'] ?: "مصروف تشغيلي ({$validated['category']})",
                sourceType: Expense::class,
                sourceId: $expense->id,
                referenceNumber: $expNo,
                transactionDate: $validated['expense_date'],
                receiptPath: $receiptPath,
                userId: $user
            );

            return response()->json([
                'message' => 'تم تسجيل المصروف المالي وخصمه من الخزينة بنجاح',
                'expense' => $expense
            ], 201);
        });
    }

    public function destroy(string $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);

        DB::transaction(function () use ($expense) {
            TreasuryService::revertBySource(Expense::class, $expense->id);
            $expense->forceDelete();
        });

        return response()->json(['message' => 'تم حذف المصروف وإلغاء خصمه من الخزينة بنجاح']);
    }
}
