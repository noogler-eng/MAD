// 704. Binary Search
#include<iostream>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        int start = 0;
        int end = nums.size() - 1;
        while(start <= end){
            int mid = start + (end - start) / 2;
            if(nums[mid] == target) return mid;
            else if (nums[mid] > target) end = mid - 1;
            else start = mid + 1;
        }
        return -1;
    }
};


// ===== CONCEPTS (auto-generated — do not edit below) =====
/*
1) PROBLEM KYA KEH RAHA HAI
Aapko ek sorted (increasing order mein) array di gayi hai aur ek target value dhoondhni hai. Agar target array mein maujood hai, toh uska index return karna hai. Agar target poore array mein kahin nahi milta, toh simple -1 return karna hai.

2) CORE CONCEPT
Yahan Binary Search technique ka use ho raha hai kyunki array already sorted hai. Normal linear search har element ko ek-ek karke check karta hai jo O(N) time leta hai. Par sorted array ki property yeh hoti hai ki agar hum middle element check karein aur target usse chhota ho, toh target confirm left side mein hi hoga, right side dekhne ki zaroorat hi nahi hai. Similarly agar target middle se bada hai, toh target confirm right side mein hoga. Is property ki wajah se hum har comparison ke baad aadha array eliminate kar dete hain.

3) DRY RUN
Input: nums = [-1, 0, 3, 5, 9, 12], target = 9

Initial state:
start = 0, end = 5

Iteration 1:
mid = start + (end - start) / 2 = 0 + (5 - 0) / 2 = 2
nums[mid] matlab nums[2] ki value hai 3.
Target (9) bada hai nums[2] (3) se, iska matlab target right side mein hai.
start update hoga: start = mid + 1 = 3.
Ab search space bacha index 3 se 5 tak: [5, 9, 12].

Iteration 2:
start = 3, end = 5
mid = 3 + (5 - 3) / 2 = 4
nums[mid] matlab nums[4] ki value hai 9.
nums[4] == target (9 == 9) condition match ho gayi.
Function turant return karega index 4.

4) COMPLEXITY
Time Complexity: O(log N) - Kyunki har iteration mein hum array ka size half karte jaa rahe hain (N -> N/2 -> N/4 ... -> 1), total operations maximum log2(N) lagenge.
Space Complexity: O(1) - Kyunki humne koi extra array ya recursive stack use nahi kiya, sirf 3 integer variables (start, end, mid) use kiye hain.

5) COMMON MISTAKES
1. Loop condition: while(start < end) likh dena instead of while(start <= end). Isse jab search space 1 element par shrink ho jaati hai (jahan start == end), loop terminate ho jaata hai aur wo last element check hone se reh jaata hai.
2. Pointers update mein galti: start = mid ya end = mid likhna. Kyunki nums[mid] already check ho chuka hai, use search space se hatane ke liye hamesha start = mid + 1 aur end = mid - 1 hi karna hota hai, warna do elements ke case mein code infinite loop mein fas jayega.
3. Integer Overflow: mid calculate karte waqt (start + end) / 2 likhna. Agar start aur end dono bohot bade numbers honge toh unka sum 32-bit signed integer limit cross karke negative ban sakta hai. Safe tareeqa start + (end - start) / 2 hota hai.
*/
// ===== END CONCEPTS =====
