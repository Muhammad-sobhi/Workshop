<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::orderBy('expense_date', 'desc');

        if ($request->filled('start_date')) {
            $query->where('expense_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('expense_date', '<=', $request->query('end_date'));
        }

        $expenses = $query->paginate(50);
        return response()->json($expenses);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'category' => 'required|string|max:255',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer',
        ]);

        $expNo = 'EXP-' . Carbon::now()->year . '-' . str_pad(Expense::count() + 1, 4, '0', STR_PAD_LEFT);

        $expense = Expense::create([
            'expense_number' => $expNo,
            'amount' => $validated['amount'],
            'expense_date' => $validated['expense_date'],
            'category' => $validated['category'],
            'description' => $validated['description'],
            'reference_number' => $validated['reference_number'],
            'payment_method' => $validated['payment_method'] ?? null,
        ]);

        return response()->json([
            'message' => 'تم تسجيل المصروف المالي بنجام',
            'expense' => $expense
        ], 201);
    }
}
